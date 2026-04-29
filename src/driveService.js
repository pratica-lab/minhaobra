/* 
  GOOGLE DRIVE SERVICE
  Este serviço gerencia a autenticação e operações no Drive.
  IMPORTANTE: Você deve preencher o CLIENT_ID e API_KEY no .env ou diretamente aqui.
*/

const getCreds = () => ({
  clientId: localStorage.getItem('DRIVE_CLIENT_ID') || '',
  apiKey: localStorage.getItem('DRIVE_API_KEY') || ''
});

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

let tokenClient;
let gapiInited = false;
let gisInited = false;

const waitForGlobal = async (checkFn, timeoutMs = 5000) => {
  const intervalMs = 100;
  const maxTries = Math.ceil(timeoutMs / intervalMs);
  let tries = 0;

  return new Promise((resolve) => {
    const poll = () => {
      if (checkFn()) return resolve(true);
      if (tries++ >= maxTries) return resolve(false);
      setTimeout(poll, intervalMs);
    };
    poll();
  });
};

const initTokenClient = () => {
  if (tokenClient) return;
  const { clientId } = getCreds();
  if (!clientId) throw new Error("Faltando DRIVE_CLIENT_ID para inicializar o Google Identity Services.");
  if (!window.google?.accounts?.oauth2) throw new Error("Google Identity Services não está carregado.");

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: () => {},
  });
};

export const initDrive = () => {
  return new Promise(async (resolve) => {
    const { clientId, apiKey } = getCreds();
    if (!clientId || !apiKey) return resolve(); // Aguarda configuração

    const readyGapi = await waitForGlobal(() => Boolean(window.gapi), 5000);
    const readyGoogle = await waitForGlobal(() => Boolean(window.google?.accounts?.oauth2), 5000);

    const checkInit = () => {
      const gapiReady = readyGapi ? gapiInited : true;
      const googleReady = readyGoogle ? gisInited : true;
      if (gapiReady && googleReady) resolve();
    };

    if (readyGapi) {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: DISCOVERY_DOCS,
        });
        gapiInited = true;
        checkInit();
      });
    }

    if (readyGoogle) {
      try {
        initTokenClient();
        gisInited = true;
      } catch (err) {
        console.error("Erro ao inicializar o token client:", err);
      }
      checkInit();
    }

    if (!readyGapi && !readyGoogle) {
      console.warn("Google APIs não foram carregadas a tempo em initDrive.");
      resolve();
    }
  });
};

// Garante que temos um token válido
export const getToken = () => {
  return new Promise((resolve, reject) => {
    try {
      if (!tokenClient) initTokenClient();
    } catch (err) {
      return reject(err);
    }

    const timeout = window.setTimeout(() => {
      reject(new Error('Tempo de autenticação esgotado. Recarregue a página e tente novamente.'));
    }, 30000);

    tokenClient.callback = (resp) => {
      window.clearTimeout(timeout);
      if (resp.error !== undefined) {
        console.error("Erro ao obter token:", resp);
        return reject(resp);
      }
      // CRITICAL: Registra o token no cliente GAPI para que as chamadas subsequentes funcionem
      if (window.gapi && window.gapi.client) {
        window.gapi.client.setToken(resp);
      }
      resolve(resp.access_token);
    };

    const currentToken = window.gapi?.client?.getToken();
    if (currentToken === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

// Encontra ou cria a pasta "Minha Obra"
export const getOrCreateFolder = async (folderName, parentId = null) => {
  try {
    const q = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentId ? ` and '${parentId}' in parents` : ''}`;
    const response = await window.gapi.client.drive.files.list({ q, fields: 'files(id, name)' });
    const files = response.result.files;

    if (files && files.length > 0) {
      return files[0].id;
    }

    // Se não existe, cria
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : []
    };
    const res = await window.gapi.client.drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    });
    const newFolderId = res.result.id;

    // Se for a pasta raiz e tiver e-mail do Luan configurado, compartilha automaticamente
    if (folderName === 'Minha Obra' && !parentId) {
      const luanEmail = localStorage.getItem('DRIVE_LUAN_EMAIL');
      if (luanEmail && luanEmail.includes('@')) {
        try {
          await shareFolder(newFolderId, luanEmail);
        } catch (err) {
          console.error("Erro ao compartilhar pasta:", err);
        }
      }
    }

    return newFolderId;
  } catch (error) {
    console.error(`Erro em getOrCreateFolder (${folderName}):`, error);
    throw new Error(`Não foi possível acessar ou criar a pasta "${folderName}" no Google Drive.`);
  }
};

const fetchWithTimeout = async (url, options, timeoutMs = 60000) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
};

// Upload de arquivo
export const uploadFile = async (file, folderName) => {
  const accessToken = await getToken(); // Garante login e obtém token

  const rootFolderId = await getOrCreateFolder('Minha Obra');
  const subFolderId = await getOrCreateFolder(folderName, rootFolderId);

  const metadata = {
    name: `${Date.now()}_${file.name}`,
    parents: [subFolderId]
  };

  // Para upload multipart/related (metadados + arquivo), precisamos construir o corpo manualmente
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const contentType = file.type || 'application/octet-stream';

  const metadataPart = JSON.stringify(metadata);

  const parts = [
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    metadataPart,
    delimiter,
    'Content-Type: ' + contentType + '\r\n\r\n',
    file,
    close_delim
  ];

  const body = new Blob(parts, { type: 'multipart/related; boundary=' + boundary });

  const resp = await fetchWithTimeout('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'multipart/related; boundary=' + boundary
    },
    body: body
  }, 60000);

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    console.error("Erro na API do Google Drive:", errorData);
    throw new Error(errorData.error?.message || "Falha ao enviar arquivo para o Google Drive.");
  }

  const result = await resp.json();
  return {
    id: result.id,
    name: result.name,
    url: result.webViewLink,
    size: (file.size / 1024 / 1024).toFixed(2) + " MB"
  };
};

// Compartilha com outro e-mail
export const shareFolder = async (folderId, email) => {
  await window.gapi.client.drive.permissions.create({
    fileId: folderId,
    resource: {
      role: 'writer',
      type: 'user',
      emailAddress: email
    }
  });
};
