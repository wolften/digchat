<?php

use App\Http\Controllers\AuditoriaController;
use App\Http\Controllers\BusinessHoursController;
use App\Http\Controllers\InternalChatController;
use App\Http\Controllers\ChannelController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\ConversationTagController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FlowController;
use App\Http\Controllers\HistoricoController;
use App\Http\Controllers\InboxController;
use App\Http\Controllers\IntegrationConfigController;
use App\Http\Controllers\IxcController;
use App\Http\Controllers\PresenceController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\QuickReplyController;
use App\Http\Controllers\ReportsController;
use App\Http\Controllers\SectorController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SurveyController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route('dashboard');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // IXC — todos os usuários autenticados (consultas e vínculo de contato).
    Route::prefix('ixc')->name('ixc.')->group(function () {
        Route::get('/search', [IxcController::class, 'search'])->name('search');
        Route::post('/contacts/{contact}/link', [IxcController::class, 'link'])->name('contacts.link');
        Route::delete('/contacts/{contact}/unlink', [IxcController::class, 'unlink'])->name('contacts.unlink');
        Route::get('/contacts/{contact}/contracts', [IxcController::class, 'contracts'])->name('contacts.contracts');
        Route::get('/contacts/{contact}/contracts/{contractId}', [IxcController::class, 'contractDetails'])->name('contracts.details');
        Route::get('/contacts/{contact}/contracts/{contractId}/consumo', [IxcController::class, 'consumoDiario'])->name('contracts.consumo');
        Route::post('/conversations/{conversation}/send-boleto', [IxcController::class, 'sendBoleto'])->name('conversations.send-boleto');
        Route::post('/conversations/{conversation}/send-pix', [IxcController::class, 'sendPix'])->name('conversations.send-pix');
    });

    // Chat interno da equipe — todos os usuários autenticados.
    Route::get('/chat-interno', [InternalChatController::class, 'index'])->name('chat-interno.index');
    Route::get('/chat-interno/{conversation}', [InternalChatController::class, 'show'])->name('chat-interno.show');
    Route::post('/chat-interno/direct', [InternalChatController::class, 'storeDirect'])->name('chat-interno.direct');
    Route::post('/chat-interno/{conversation}/messages', [InternalChatController::class, 'storeMessage'])->name('chat-interno.messages.store');
    Route::get('/chat-interno/{conversation}/messages/{message}/seen-by', [InternalChatController::class, 'seenBy'])->name('chat-interno.messages.seen-by');
    Route::post('/chat-interno/{conversation}/read', [InternalChatController::class, 'markRead'])->name('chat-interno.read');
    Route::post('/chat-interno/{conversation}/typing', [InternalChatController::class, 'typing'])->name('chat-interno.typing');

    // Anotações de contato — todos os usuários autenticados.
    Route::patch('/contacts/{contact}/notes', [ContactController::class, 'updateNotes'])->name('contacts.notes.update');
    Route::get('/contacts/{contact}/conversations/{conversation}/history', [InboxController::class, 'contactConversationHistory'])
        ->name('contacts.conversations.history');

    // Atendimento (inbox) — todos os usuários autenticados.
    Route::put('/inbox/{conversation}/tags', [ConversationTagController::class, 'sync'])->name('inbox.conversations.tags');
    Route::get('/inbox', [InboxController::class, 'index'])->name('inbox.index');
    Route::get('/inbox/{conversation}', [InboxController::class, 'show'])->name('inbox.show');
    Route::post('/inbox/{conversation}/assign', [InboxController::class, 'assign'])->name('inbox.assign');
    Route::post('/inbox/{conversation}/messages', [InboxController::class, 'sendMessage'])->name('inbox.messages.store');
    Route::post('/inbox/{conversation}/internal-messages', [InboxController::class, 'sendInternalMessage'])->name('inbox.internal-messages.store');
    Route::post('/inbox/{conversation}/viewing', [InboxController::class, 'viewing'])->name('inbox.viewing');
    Route::post('/inbox/{conversation}/snooze', [InboxController::class, 'snooze'])->name('inbox.snooze');
    Route::post('/inbox/{conversation}/wake', [InboxController::class, 'wake'])->name('inbox.wake');
    Route::get('/inbox/messages/{message}/media', [InboxController::class, 'media'])->name('inbox.messages.media');
    Route::post('/inbox/messages/{message}/transcribe', [InboxController::class, 'transcribe'])->name('inbox.messages.transcribe');
    Route::post('/inbox/{conversation}/close', [InboxController::class, 'close'])->name('inbox.close');
    Route::post('/inbox/{conversation}/force-close', [InboxController::class, 'forceClose'])->name('inbox.force-close')->middleware('role:admin,gestor');
    Route::post('/inbox/{conversation}/transfer', [InboxController::class, 'transfer'])->name('inbox.transfer');

    // Histórico — todos os usuários autenticados (exportação restrita a gestores).
    Route::get('/historico', [HistoricoController::class, 'index'])->name('historico.index');

    // Fluxos de atendimento — somente admin e gestor.
    Route::middleware('role:admin,gestor')->prefix('flows')->name('flows.')->group(function () {
        Route::get('/', [FlowController::class, 'index'])->name('index');
        Route::get('/create', [FlowController::class, 'create'])->name('create');
        Route::post('/', [FlowController::class, 'store'])->name('store');
        Route::get('/{flow}/edit', [FlowController::class, 'edit'])->name('edit');
        Route::put('/{flow}', [FlowController::class, 'update'])->name('update');
        Route::delete('/{flow}', [FlowController::class, 'destroy'])->name('destroy');
        Route::patch('/{flow}/activate', [FlowController::class, 'activate'])->name('activate');
    });

    // Gestão administrativa — somente admin e gestor.
    Route::middleware('role:admin,gestor')->group(function () {
        Route::get('/presenca', [PresenceController::class, 'index'])->name('presence.index');
        Route::get('/auditoria', [AuditoriaController::class, 'index'])->name('auditoria.index');
        Route::get('/auditoria/export', [AuditoriaController::class, 'export'])->name('auditoria.export');

        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');

        Route::get('/setores', [SectorController::class, 'index'])->name('setores.index');
        Route::post('/setores', [SectorController::class, 'store'])->name('setores.store');
        Route::put('/setores/{sector}', [SectorController::class, 'update'])->name('setores.update');
        Route::delete('/setores/{sector}', [SectorController::class, 'destroy'])->name('setores.destroy');
        Route::post('/setores/{sector}/users', [SectorController::class, 'syncUsers'])->name('setores.users.sync');

        Route::get('/pesquisas', [SurveyController::class, 'index'])->name('pesquisas.index');
        Route::post('/pesquisas', [SurveyController::class, 'store'])->name('pesquisas.store');
        Route::get('/pesquisas/create', [SurveyController::class, 'create'])->name('pesquisas.create');
        Route::get('/pesquisas/response/{response}', [SurveyController::class, 'responseDetail'])->name('pesquisas.response.detail');
        Route::get('/pesquisas/{survey}', [SurveyController::class, 'show'])->name('pesquisas.show');
        Route::put('/pesquisas/{survey}', [SurveyController::class, 'update'])->name('pesquisas.update');
        Route::delete('/pesquisas/{survey}', [SurveyController::class, 'destroy'])->name('pesquisas.destroy');
        Route::post('/pesquisas/{survey}/questions', [SurveyController::class, 'syncQuestions'])->name('pesquisas.questions.sync');
        Route::get('/pesquisas/{survey}/responses', [SurveyController::class, 'responses'])->name('pesquisas.responses');

        Route::get('/respostas-rapidas', [QuickReplyController::class, 'index'])->name('respostas-rapidas.index');
        Route::post('/respostas-rapidas', [QuickReplyController::class, 'store'])->name('respostas-rapidas.store');
        Route::put('/respostas-rapidas/{quickReply}', [QuickReplyController::class, 'update'])->name('respostas-rapidas.update');
        Route::delete('/respostas-rapidas/{quickReply}', [QuickReplyController::class, 'destroy'])->name('respostas-rapidas.destroy');

        Route::get('/horarios', [BusinessHoursController::class, 'index'])->name('horarios.index');
        Route::put('/horarios', [BusinessHoursController::class, 'update'])->name('horarios.update');

        Route::get('/etiquetas', [TagController::class, 'index'])->name('tags.index');
        Route::post('/etiquetas', [TagController::class, 'store'])->name('tags.store');
        Route::put('/etiquetas/{tag}', [TagController::class, 'update'])->name('tags.update');
        Route::delete('/etiquetas/{tag}', [TagController::class, 'destroy'])->name('tags.destroy');

        Route::get('/historico/export', [HistoricoController::class, 'export'])->name('historico.export');

        Route::get('/relatorios', [ReportsController::class, 'index'])->name('relatorios.index');
        Route::get('/relatorios/export', [ReportsController::class, 'export'])->name('relatorios.export');

        // Canais (omnichannel) — admin e gestor
        Route::get('/canais', [ChannelController::class, 'index'])->name('canais.index');
        Route::post('/canais', [ChannelController::class, 'store'])->name('canais.store');
        Route::put('/canais/{channel}', [ChannelController::class, 'update'])->name('canais.update');
        Route::delete('/canais/{channel}', [ChannelController::class, 'destroy'])->name('canais.destroy');
        Route::post('/canais/{channel}/test', [ChannelController::class, 'testConnection'])->name('canais.test');
        Route::post('/canais/{channel}/webhook', [ChannelController::class, 'registerWebhook'])->name('canais.webhook');
        Route::post('/canais/{channel}/regenerate-key', [ChannelController::class, 'regenerateApiKey'])->name('canais.regenerate-key');

        Route::middleware('role:admin')->group(function () {
            Route::get('/configuracoes', [SettingsController::class, 'index'])->name('configuracoes.index');
            Route::post('/configuracoes', [SettingsController::class, 'update'])->name('configuracoes.update');
            Route::post('/configuracoes/whatsapp/health', [SettingsController::class, 'whatsappHealth'])->name('configuracoes.whatsapp-health');
            Route::post('/configuracoes/sistema', [SettingsController::class, 'updateSystem'])->name('configuracoes.update-system');

            // Integrações (CRUD + teste de conexão).
            Route::post('/configuracoes/integracoes', [IntegrationConfigController::class, 'store'])->name('integracoes.store');
            Route::put('/configuracoes/integracoes/{integrationConfig}', [IntegrationConfigController::class, 'update'])->name('integracoes.update');
            Route::delete('/configuracoes/integracoes/{integrationConfig}', [IntegrationConfigController::class, 'destroy'])->name('integracoes.destroy');
            Route::post('/configuracoes/integracoes/{integrationConfig}/test', [IntegrationConfigController::class, 'testConnection'])->name('integracoes.test');
        });
    });
});

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile/photo', [ProfileController::class, 'destroyPhoto'])->name('profile.photo.destroy');
    Route::patch('/profile/color-theme', [ProfileController::class, 'updateColorTheme'])->name('profile.color-theme');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
