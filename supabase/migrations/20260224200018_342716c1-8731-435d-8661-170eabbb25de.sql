
-- Add last_outbound_at to winners
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS last_outbound_at timestamp with time zone;

-- Seed integration_configs for hybrid receipt system
INSERT INTO public.integration_configs (key, value, label, description)
VALUES
  ('INBOUND_WINDOW_HOURS', '24', 'Janela de Inbound (horas)', 'Número de horas após última interação do cliente para considerar a janela aberta para envio automático.'),
  ('AUTO_SEND_RECEIPT_ON_INBOUND', 'true', 'Auto-envio de comprovante no inbound', 'Se habilitado, ao receber mensagem inbound de um ganhador com comprovante anexado, o sistema envia automaticamente.'),
  ('RECEIPT_CONFIRMATION_TEMPLATE', 'Olá! Temos seu comprovante de pagamento referente ao prêmio. Responda esta mensagem para recebê-lo.', 'Template de confirmação de comprovante', 'Mensagem enviada ao cliente pedindo que responda para liberar o envio do comprovante.')
ON CONFLICT (key) DO NOTHING;
