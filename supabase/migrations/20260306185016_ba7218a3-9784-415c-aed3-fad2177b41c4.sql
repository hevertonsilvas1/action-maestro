INSERT INTO integration_configs (key, value, label, description) VALUES
  ('UNNICHAT_INBOUND_SECRET', '', 'Chave Secreta Inbound', 'Secret enviado no header x-webhook-secret pela UnniChat para validar chamadas inbound'),
  ('UNNICHAT_COMPROVANTE', '', 'Webhook Comprovante', 'URL do webhook da UnniChat para envio de comprovantes de pagamento')
ON CONFLICT DO NOTHING;