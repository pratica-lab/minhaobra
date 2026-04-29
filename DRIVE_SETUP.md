# Google Drive Integration - Setup Guide

## Visão Geral

O aplicativo utiliza Google Drive API para upload e armazenamento de arquivos (contratos, projetos, comprovantes de gastos). O serviço foi reescrito com foco em:

- **FormData para multipart**: Mais confiável que construção manual de boundaries
- **Retry automático**: 3 tentativas com backoff exponencial (1s, 2s, 4s)
- **Timeout adequado**: 2 minutos para upload, 45s para autenticação
- **Cache de token**: Reutiliza token válido até expirar (economiza requisições)
- **Logging detalhado**: Console mostra cada passo do processo
- **Tratamento robusto de erros**: Diferencia entre timeout, autenticação, permissão, etc.

## Configuração Necessária

### 1. Google Cloud Project

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Vá para **APIs & Services > Credentials**
4. Clique em **Create Credentials > OAuth 2.0 Client ID**
5. Selecione **Web application**
6. Em **Authorized JavaScript origins**, adicione:
   - `http://localhost:5173` (desenvolvimento)
   - `http://localhost:3000` (se usar outro port)
   - `https://seu-dominio.com` (produção)
7. Em **Authorized redirect URIs**, adicione os mesmos URLs
8. Copie o **Client ID**

### 2. Ativar API do Google Drive

1. Em **APIs & Services > Enabled APIs & services**
2. Clique em **Enable APIs and Services**
3. Procure por **Google Drive API**
4. Clique em **Enable**

### 3. Configurar Credenciais no App

As credenciais são armazenadas em **localStorage**:

```javascript
// No browser console ou em algum lugar da interface:
localStorage.setItem('DRIVE_CLIENT_ID', 'SEU_CLIENT_ID_AQUI');
localStorage.setItem('DRIVE_API_KEY', 'SEU_API_KEY_AQUI'); // Opcional, pode usar null
localStorage.setItem('DRIVE_LUAN_EMAIL', 'luan@example.com'); // Opcional, para compartilhamento
```

Ou configure via interface (se existir um painel de settings).

## Como Funciona o Fluxo

### Inicialização
```
App inicia → initDrive() é chamado
  ↓
Aguarda Google APIs (gapi, google.accounts)
  ↓
Inicializa tokenClient quando Google Accounts está pronto
```

### Upload de Arquivo
```
Usuário seleciona arquivo
  ↓
Validação (tamanho, tipo)
  ↓
getToken() - Obtém access token (com retry se expirar)
  ↓
getOrCreateFolder('Minha Obra') - Pasta raiz
  ↓
getOrCreateFolder(folderName, rootId) - Subpasta (contratos/projetos/gastos)
  ↓
uploadFile() - Envia arquivo via FormData com retry 3x
  ↓
Retorna {id, name, url, size, mimeType, createdTime}
```

### Tratamento de Erros
- **401 Unauthorized**: Token inválido, limpa cache e pede novo
- **403 Forbidden**: Sem permissão, verifica credenciais
- **Timeout**: Retry automático com backoff (1s → 2s → 4s)
- **Network Error**: Retry automático
- **Invalid response**: Valida presença de campos obrigatórios

## Arquivos Modificados

### `/src/driveService.js`
- `initDrive()` - Inicializa, aguarda Google APIs com timeout
- `getToken()` - Obtém token OAuth2 com cache e timeout
- `getOrCreateFolder()` - Cria hierarquia de pastas com query encoded
- `uploadFile()` - Upload multipart com FormData e retry
- `shareFolder()` - Compartilha pasta com outro e-mail
- `downloadFile()` - Baixa arquivo (suporte futuro)
- `deleteFile()` - Deleta arquivo (suporte futuro)
- `fetchWithRetry()` - Fetch com retry e timeout (120s)
- Logging detalhado em cada operação

### `/src/App.jsx`
- `handleFileChange()` - Upload de contrato/projeto com validações
- `handleGastoFile()` - Upload de comprovante com validações
- `uploadToStorage()` - Wrapper que traduz erros em mensagens amigáveis
- Mensagens de erro específicas por tipo de problema

## Debugging

### Ativar Verbose Logging
Abra o **DevTools Console** (F12) e procure por mensagens `[DriveService]`:

```javascript
// Exemplo de output esperado:
[DriveService] Iniciando Drive Service...
[DriveService] tokenClient inicializado com sucesso
[DriveService] Iniciando upload: foto.jpg (2.5MB) para "contratos"
[DriveService] Token obtido com sucesso { expiresIn: 3600 }
[DriveService] Procurando ou criando pasta: "Minha Obra"
[DriveService] Pasta encontrada: 1A2b3C4d5E6f7G8h
[DriveService] Metadados preparados { name: '1234567890_foto.jpg', ... }
[DriveService] Enviando arquivo para Google Drive API...
[DriveService] Upload concluído com sucesso { id: 'fileId123', ... }
```

### Problemas Comuns

#### ❌ "Cannot set properties of undefined (setting 'callback')"
**Causa**: tokenClient não foi inicializado antes de usar
**Solução**: Agora tratado - retry automático de inicialização

#### ❌ "Timeout ao obter token"
**Causa**: Google Accounts API não carregou ou rede lenta
**Solução**: Recarregue a página, verifique conexão, tente novamente

#### ❌ "Arquivo muito grande"
**Causa**: Arquivo > 100MB
**Solução**: Comprimir arquivo ou dividir em partes

#### ❌ "Sem permissão para fazer upload" (403)
**Causa**: Credenciais incorretas ou falta de permissão
**Solução**: Verifique DRIVE_CLIENT_ID e se Drive API está ativada

#### ❌ "Arquivo preso em 'Enviando...'"
**Causa**: Timeout anteriormente (agora com retry e timeout adequado)
**Solução**: Deve funcionar agora com novo serviço. Se persistir, verifique logs.

## Testes Recomendados

1. **Teste de Autenticação**
   - Abra DevTools Console
   - Teste: `localStorage.setItem('DRIVE_CLIENT_ID', 'SEU_ID')`
   - Recarregue página
   - Tente fazer upload de um arquivo pequeno (< 1MB)

2. **Teste de Arquivo Pequeno**
   - Selecione imagem JPEG < 1MB
   - Aguarde upload completar
   - Verifique console para logs

3. **Teste de Arquivo Maior**
   - Selecione arquivo > 5MB
   - Verifique retry automático se rede for lenta

4. **Teste de Erro**
   - Desligue internet
   - Tente fazer upload
   - Ligue internet novamente
   - Retry automático deve funcionar

## Estrutura de Pastas Criada

```
Google Drive
├── Minha Obra (compartilhada com DRIVE_LUAN_EMAIL se configurado)
│   ├── contratos/
│   │   └── 1234567890_contrato.pdf
│   ├── projetos/
│   │   └── 1234567890_planta.dwg
│   └── gastos/
│       └── 1234567890_recibo.jpg
```

## API Reference

### `initDrive()`
Inicializa o serviço de Drive. Chamada automaticamente no App mount.

### `getToken(): Promise<string>`
Retorna access token do Google OAuth2. Com cache e retry automático.

### `uploadFile(file: File, folderName: string): Promise<{id, name, url, size, mimeType, createdTime}>`
Faz upload de arquivo. Cria pastas conforme necessário. Com retry 3x.

### `downloadFile(fileId: string, fileName: string): Promise<void>`
Baixa arquivo do Drive (suporte futuro).

### `deleteFile(fileId: string): Promise<void>`
Deleta arquivo do Drive (suporte futuro).

### `shareFolder(fileId: string, email: string): Promise<void>`
Compartilha arquivo com um e-mail.

## Segurança

- ⚠️ **Client ID é público** - Isso é esperado no OAuth2 de web apps
- ✅ **Access tokens têm validade limitada** (geralmente 1 hora)
- ✅ **Tokens são cacheados apenas em memória** (não persistem entre páginas)
- ✅ **Arquivo não armazena credenciais em localStorage** (apenas CLIENT_ID)
- 🔐 **Para produção**: Configure CORS adequadamente no Google Cloud

## Referências

- [Google Drive API Docs](https://developers.google.com/drive/api/v3)
- [OAuth 2.0 Client](https://developers.google.com/identity/protocols/oauth2)
- [Upload Files to Drive](https://developers.google.com/drive/api/v3/manage-uploads)
