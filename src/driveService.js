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

export const initDrive = () => {
  return new Promise((resolve, reject) => {
    const { clientId, apiKey } = getCreds();
    if (!clientId || !apiKey) return resolve(); // Aguarda configuração

    // 1. Carregar GAPI
    const loadGapi = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: DISCOVERY_DOCS,
        });
        gapiInited = true;
        checkInit();
      });
    };

    // 2. Carregar GIS (Identity Services)
    const loadGis = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: '', // Definido na hora do uso
      });
      gisInited = true;
      checkInit();
    };

    const checkInit = () => {
      if (gapiInited && gisInited) resolve();
    };

    if (window.gapi) loadGapi();
    if (window.google) loadGis();
  });
};

// Garante que temos um token válido
export const getToken = () => {
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error !== undefined) reject(resp);
      resolve(resp.access_token);
    };

    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

// Encontra ou cria a pasta "Minha Obra"
export const getOrCreateFolder = async (folderName, parentId = null) => {
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
};

// Upload de arquivo
export const uploadFile = async (file, folderName) => {
  await getToken(); // Garante login

  const rootFolderId = await getOrCreateFolder('Minha Obra');
  const subFolderId = await getOrCreateFolder(folderName, rootFolderId);

  const metadata = {
    name: `${Date.now()}_${file.name}`,
    parents: [subFolderId]
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', file);

  const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${window.gapi.client.getToken().access_token}` },
    body: formData
  });

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
