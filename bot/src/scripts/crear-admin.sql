-- Actualizar el rol del participante con el ID de Telegram del administrador
UPDATE notif_eventos_bot.participants 
SET rol = 'admin' 
WHERE telegramid = '5694130379';

-- Si el participante no existe, crearlo
INSERT INTO notif_eventos_bot.participants (telegramid, nac, cedula, firstname, lastname, rol)
SELECT '5694130379', 'V', '12345678', 'Administrador', 'Sistema', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM notif_eventos_bot.participants WHERE telegramid = '5694130379');

-- Mostrar el participante actualizado
SELECT * FROM notif_eventos_bot.participants 
WHERE telegramid = '5694130379'; 