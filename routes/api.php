<?php

use App\Http\Controllers\TelegramWebhookController;
use App\Http\Controllers\WhatsAppWebhookController;
use Illuminate\Support\Facades\Route;

// WhatsApp Cloud API — GET = verificação, POST = mensagens/status
Route::match(['get', 'post'], '/webhooks/whatsapp', WhatsAppWebhookController::class)
    ->name('webhooks.whatsapp');

// Telegram Bot API — POST = updates (mensagens, callback_queries)
Route::post('/webhooks/telegram/{channel}', TelegramWebhookController::class)
    ->name('webhooks.telegram');
