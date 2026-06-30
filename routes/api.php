<?php

use App\Http\Controllers\TelegramWebhookController;
use App\Http\Controllers\WebChatController;
use App\Http\Controllers\WhatsAppWebhookController;
use Illuminate\Support\Facades\Route;

// WhatsApp Cloud API — GET = verificação, POST = mensagens/status
Route::match(['get', 'post'], '/webhooks/whatsapp', WhatsAppWebhookController::class)
    ->name('webhooks.whatsapp');

// Telegram Bot API — POST = updates (mensagens, callback_queries)
Route::post('/webhooks/telegram/{channel}', TelegramWebhookController::class)
    ->name('webhooks.telegram');

// Web Chat Widget API — pública, requer api_key / session_token, sem auth Laravel
Route::prefix('webchat/{channel}')->group(function () {
    Route::options('/{any?}', [WebChatController::class, 'preflight'])->where('any', '.*');
    Route::post('/init',           [WebChatController::class, 'init'])->name('webchat.init');
    Route::post('/messages',       [WebChatController::class, 'send'])->name('webchat.send');
    Route::get('/messages',        [WebChatController::class, 'poll'])->name('webchat.poll');
    Route::get('/media/{message}', [WebChatController::class, 'media'])->name('webchat.media');
});
