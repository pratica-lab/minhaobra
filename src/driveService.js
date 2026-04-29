/* 
  GOOGLE DRIVE SERVICE
  Gerencia autenticação OAuth2 e upload de arquivos para Google Drive.
*/

const getCreds = () => ({
  clientId: localStorage.getItem('DRIVE_CLIENT_ID') || '',
  apiKey: localStorage.getItem('DRIVE_API_KEY') || ''
});

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
let tokenClient;
let cachedToken = null;
let tokenExpiry = 0;

const log = (msg, data = null) => {
  console.log(`[DriveService] ${msg}`, data || '');
};

const logError = (msg, err = null) => {
  console.error(`[DriveService ERROR] ${msg}`, err || '');
};

const waitForGlobal = async (checkFn, timeoutMs = 10000) => {
  const start = Date.now();
  while (!checkFn() && Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 100));
  }
  return checkFn();
};

const initTokenClient = () => {
  if (tokenClient) return true;
  
  const { clientId } = getCreds();
  if (!clientId) {
    logError("DRIVE_CLIENT_ID não configurado no localStorage");
    return false;
  }

  if (!window.google?.accounts?.oauth2) {
    logError("Google Identity Services não está disponível");
    return false;
  }

  try {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: () => {}, // será sobrescrito em getToken
    });
    log("tokenClient inicializado com sucesso");
    return true;
  } catch (err) {
    logError("Erro ao inicializar tokenClient", err);
    return false;
  }
};

export const initDrive = async () => {
  log("Iniciando Drive Service...");
  
  const { clientId, apiKey } = getCreds();
  if (!clientId || !apiKey) {
    log("Credenciais não configuradas. Aguardando configuração manual.");
    return;
  }

  // Aguarda Google APIs
  const hasGapi = await waitForGlobal(() => Boolean(window.gapi), 10000);
  const hasGoogleAccounts = await waitForGlobal(() => Boolean(window.google?.accounts?.oauth2), 10000);

  if (!hasGapi) {
    logError("GAPI não foi carregado após 10s");
  }
  if (!hasGoogleAccounts) {
    logError("Google Accounts não foi carregado após 10s");
  }

  // Tenta inicializar o token client
  if (hasGoogleAccounts) {
    initTokenClient();
  }

  log("Drive Service inicializado");
};

export const getToken = () => {
  return new Promise((resolve, reject) => {
    try {
      if (!initTokenClient()) {
        return reject(new Error("Não foi possível inicializar o token client. Verifique se DRIVE_CLIENT_ID está configurado."));
      }
    } catch (err) {
      return reject(err);
    }

    // Se temos um token em cache e ainda não expirou, usa ele
    if (cachedToken && tokenExpiry > Date.now()) {
      log("Usando token em cache");
      return resolve(cachedToken);
    }

    const timeout = window.setTimeout(() => {
      reject(new Error('Timeout ao obter token do Google. Verifique sua conexão e tente novamente.'));
    }, 45000);

    tokenClient.callback = (resp) => {
      window.clearTimeout(timeout);
      
      if (resp.error) {
        logError("Erro na autenticação do Google", resp.error);
        return reject(new Error(resp.error));
      }

      if (!resp.access_token) {
        logError("Token não recebido da autenticação");
        return reject(new Error("Não foi recebido token do Google"));
      }

      // Cacheia o token e define expiração (geralmente 3600s, deixamos margem)
      cachedToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in - 300) * 1000;
      
      log("Token obtido com sucesso", { expiresIn: resp.expires_in });
      resolve(resp.access_token);
    };

    const currentToken = window.gapi?.client?.getToken?.();
    try {
      if (currentToken === null) {
        log("Token expirado, solicitando novo com prompt de consentimento");
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        log("Token válido, solicitando silenciosamente");
        tokenClient.requestAccessToken({ prompt: '' });
      }
    } catch (err) {
      window.clearTimeout(timeout);
      logError("Erro ao solicitar token", err);
      reject(err);
    }
  });
};

// Cria requisição com retry automático
const fetchWithRetry = async (url, options, maxRetries = 3) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 120000); // 2 minutos

  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`Tentativa ${attempt}/${maxRetries}: ${url.split('?')[0]}`);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      window.clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logError(`HTTP ${response.status}:`, errorText);
        
        // Se for erro de autenticação, limpa o cache de token
        if (response.status === 401) {
          cachedToken = null;
          tokenExpiry = 0;
        }

        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return response;
    } catch (err) {
      lastError = err;
      
      if (err.name === 'AbortError') {
        logError(`Timeout na tentativa ${attempt}`);
        break;
      }

      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        log(`Erro na tentativa ${attempt}, aguardando ${waitTime}ms antes de retry...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }

  window.clearTimeout(timeoutId);
  throw lastError || new Error('Falha após múltiplas tentativas');
};

// Encontra ou cria pasta no Google Drive
export const getOrCreateFolder = async (folderName, parentId = null) => {
  try {
    const token = await getToken();
    
    log(`Procurando ou criando pasta: "${folderName}"`);

    // Query para encontrar a pasta
    const q = encodeURIComponent(
      `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false` +
      (parentId ? ` and '${parentId}' in parents` : '')
    );

    const listResponse = await fetchWithRetry(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const listData = await listResponse.json();
    
    if (listData.files && listData.files.length > 0) {
      log(`Pasta encontrada: ${listData.files[0].id}`);
      return listData.files[0].id;
    }

    // Pasta não existe, cria nova
    log(`Pasta não encontrada, criando: "${folderName}"`);

    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentId) {
      metadata.parents = [parentId];
    }

    const createResponse = await fetchWithRetry(
      'https://www.googleapis.com/drive/v3/files?fields=id',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      }
    );

    const createData = await createResponse.json();
    
    if (!createData.id) {
      throw new Error('Resposta inválida ao criar pasta: sem ID');
    }

    log(`Pasta criada com sucesso: ${createData.id}`);

    // Compartilha com Luan se for a pasta raiz
    if (folderName === 'Minha Obra' && !parentId) {
      const luanEmail = localStorage.getItem('DRIVE_LUAN_EMAIL');
      if (luanEmail && luanEmail.includes('@')) {
        try {
          await shareFolder(createData.id, luanEmail);
        } catch (err) {
          logError(`Erro ao compartilhar pasta com ${luanEmail}`, err);
        }
      }
    }

    return createData.id;
  } catch (error) {
    logError(`Erro em getOrCreateFolder("${folderName}")`, error);
    throw error;
  }
};

// Upload de arquivo usando fetch e FormData
export const uploadFile = async (file, folderName) => {
  try {
    if (!file) throw new Error("Arquivo não fornecido");
    if (!folderName) throw new Error("Nome da pasta não fornecido");

    log(`Iniciando upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) para "${folderName}"`);

    const token = await getToken();
    log("Token obtido com sucesso");

    // Obtém ou cria as pastas
    const rootFolderId = await getOrCreateFolder('Minha Obra');
    const subFolderId = await getOrCreateFolder(folderName, rootFolderId);

    // Prepara metadados do arquivo
    const metadata = {
      name: `${Date.now()}_${file.name}`,
      parents: [subFolderId],
      mimeType: file.type || 'application/octet-stream',
    };

    log(`Metadados preparados`, metadata);

    // Usa FormData para multipart (muito mais confiável que construir manualmente)
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    log("Enviando arquivo para Google Drive API...");

    const uploadResponse = await fetchWithRetry(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size,mimeType,createdTime',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      },
      3 // até 3 tentativas
    );

    const uploadData = await uploadResponse.json();

    if (!uploadData.id) {
      throw new Error('Resposta inválida do Google Drive: sem ID do arquivo');
    }

    log(`Upload concluído com sucesso`, {
      id: uploadData.id,
      name: uploadData.name,
      size: uploadData.size,
      url: uploadData.webViewLink,
    });

    return {
      id: uploadData.id,
      name: uploadData.name,
      url: uploadData.webViewLink,
      size: uploadData.size ? (uploadData.size / 1024 / 1024).toFixed(2) + ' MB' : file.size,
      mimeType: uploadData.mimeType,
      createdTime: uploadData.createdTime,
    };
  } catch (error) {
    logError(`Erro em uploadFile("${file?.name}", "${folderName}")`, error);
    throw error;
  }
};

// Compartilha arquivo/pasta com um e-mail
export const shareFolder = async (fileId, email) => {
  try {
    const token = await getToken();

    log(`Compartilhando ${fileId} com ${email}`);

    const response = await fetchWithRetry(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=id`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'writer',
          type: 'user',
          emailAddress: email,
        }),
      }
    );

    const data = await response.json();
    log(`Compartilhamento concluído`, data);
    return data;
  } catch (error) {
    logError(`Erro ao compartilhar com ${email}`, error);
    throw error;
  }
};

// Baixa um arquivo do Google Drive
export const downloadFile = async (fileId, fileName) => {
  try {
    const token = await getToken();

    log(`Baixando arquivo: ${fileId}`);

    const response = await fetchWithRetry(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const blob = await response.blob();

    // Cria link de download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || fileId;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);

    log(`Arquivo baixado: ${fileName}`);
  } catch (error) {
    logError(`Erro ao baixar arquivo ${fileId}`, error);
    throw error;
  }
};

// Remove arquivo do Google Drive
export const deleteFile = async (fileId) => {
  try {
    const token = await getToken();

    log(`Deletando arquivo: ${fileId}`);

    await fetchWithRetry(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    log(`Arquivo deletado com sucesso`);
  } catch (error) {
    logError(`Erro ao deletar arquivo ${fileId}`, error);
    throw error;
  }
};
