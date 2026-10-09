# Correção do envio de áudio

## Diagnóstico confirmado

Em 09/10/2026 às 19:49 UTC, o preflight `OPTIONS` do endpoint configurado no HTML retornou **HTTP 404**:

```json
{"code":"NOT_FOUND","message":"Requested function was not found"}
```

Endpoint: `https://xawlsjjezqaawcpvyccx.supabase.co/functions/v1/isabela-ai`.
Origem testada: `https://localhost` (APK Capacitor).
O gateway retornou `sb-error-code: NOT_FOUND`; o preflight não teve status de sucesso e não autorizou `content-type`. Assim, o WebView pode ocultar o 404 como `Failed to send a request to the Edge Function`. A falha ocorre antes da transcrição. A presença de `server: cloudflare` na resposta do gateway **não** comprova chamada ao Workers AI.

O repositório original não tinha função Supabase/Worker, apenas HTML, ícones e a receita de build Android. Não foi possível inspecionar código ou logs de um backend anterior.

## O que mudou

- Função `supabase/functions/isabela-ai`: OPTIONS sem autenticação, CORS em todas as respostas do handler, validação de usuário no Supabase Auth, limite de 5 MiB e timeout.
- Transcrição: JSON `{mode:'transcribe',audioBase64,mimeType}` → base64 decodificado → áudio binário enviado pelo servidor ao modelo `@cf/openai/whisper` → `{text}`. Não é necessário criar um Worker separado: a função usa a API REST do Workers AI.
- Os modos existentes `summary`, `report` e `query` continuam aceitos; usam `CLOUDFLARE_TEXT_MODEL` ou `@cf/meta/llama-3.1-8b-instruct-fast`.
- HTML: chamada centralizada com sessão, validação de áudio vazio/tamanho, bloqueio de envio concorrente, identificação de M4A sem MIME e diagnóstico mais claro. As gravações permanecem disponíveis após falhas.
- Android: origem HTTPS localhost explicitada (mesmo padrão Capacitor), internet e microfone conferidos no manifesto gerado. Sem habilitar HTTP inseguro ou alterar o transporte global. Corrigir a publicação/CORS no servidor resolve também o APK já instalado que usa este contrato.
- Pull requests passam a executar testes e compilação do APK.

## Publicação necessária no Supabase

**Gerar ou instalar outro APK sozinho não publica a função ausente.**

1. No projeto Supabase `xawlsjjezqaawcpvyccx`, abrir **Edge Functions → Secrets** e cadastrar:
   - `CLOUDFLARE_ACCOUNT_ID`: ID da conta Cloudflare.
   - `CLOUDFLARE_API_TOKEN`: token com permissões Workers AI Read/Edit nessa conta.
   - Opcional: `CLOUDFLARE_TEXT_MODEL` para o modelo de texto da conta. O contrato esperado é `messages` → `result.response`.
   `SUPABASE_URL` e `SUPABASE_ANON_KEY` são fornecidos pelo ambiente hospedado. Nunca colocar token Cloudflare, chave service-role ou access token no HTML ou no GitHub em texto aberto.
2. Com a CLI Supabase autenticada, na raiz deste checkout:

   ```sh
   supabase login
   supabase functions deploy isabela-ai --project-ref xawlsjjezqaawcpvyccx
   ```

   Manter `verify_jwt = true`. Além da verificação do gateway, a função exige um usuário válido no Auth; a chave pública anon não autoriza consumo da IA por conta própria.
3. Conferir preflight:

   ```sh
   curl -i -X OPTIONS \
     'https://xawlsjjezqaawcpvyccx.supabase.co/functions/v1/isabela-ai' \
     -H 'Origin: https://localhost' \
     -H 'Access-Control-Request-Method: POST' \
     -H 'Access-Control-Request-Headers: authorization,apikey,content-type,x-client-info'
   ```

   Esperado: HTTP 204, `Access-Control-Allow-Origin: *`, métodos POST/OPTIONS e os quatro headers solicitados autorizados.
4. Entrar no aplicativo, gravar uma frase fictícia em português, finalizar e enviar. Repetir em evolução diária, relatório e com arquivo M4A. Conferir fidelidade do texto e testar recuperação após ficar sem internet. Não usar dados de pacientes nesses testes.
5. Após integrar o PR, baixar `Isabela-Martins-APK` em **Actions → Build Isabela Martins APK**. O artefato continua sendo APK de debug, como no workflow anterior.

## Testes e limites da validação

Executar `node --test tests/*.test.mjs` com Node 22 ou superior. Os testes exercitam o handler real, a integração com o helper extraído do HTML e os dois fluxos de UI, com Supabase Auth/Cloudflare simulados. Eles verificam bytes exatos, autenticação, CORS, formatos, limite, concorrência, erros HTTP, rede, timeout e manutenção do áudio para tentar novamente. A aceitação de um MIME no teste não comprova decodificação real de cada codec pela Cloudflare.

O preflight de produção foi consultado, mas não houve deploy Supabase nem transcrição real: essas etapas exigem acesso ao projeto/credenciais Cloudflare. Não há aparelho Android nesta sessão; o teste de microfone, instalação e qualidade da transcrição precisa ser concluído em dispositivo após publicação. A compilação do APK pode ser conferida no workflow do PR.

Referências oficiais:
- https://supabase.com/docs/guides/functions/cors
- https://supabase.com/docs/guides/functions/auth-headers
- https://developers.cloudflare.com/workers-ai/models/whisper/
- https://developers.cloudflare.com/workers-ai/models/whisper/schema-input.json
- https://developers.cloudflare.com/workers-ai/get-started/rest-api/
