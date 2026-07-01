<?php

namespace App\Http\Middleware;

use App\Models\AppSetting;
use App\Models\Conversation;
use App\Services\InternalChat\InternalChatService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'warning' => fn () => $request->session()->get('warning'),
            ],
            'appName'     => AppSetting::get('app_name', config('app.name')) ?: config('app.name'),
            'appIconUrl'  => AppSetting::get('app_icon_url'),
            'appSubtitle' => AppSetting::get('app_subtitle', 'Atendimento inteligente') ?: 'Atendimento inteligente',
            'appTimezone' => (string) config('app.timezone', 'America/Sao_Paulo'),
            'autoTranscribeAudio' => AppSetting::bool('auto_transcribe_audio', true),
            'inboxBadgeCount' => function () use ($request) {
                $user = $request->user();
                if (! $user) {
                    return 0;
                }

                $query = Conversation::query();

                if ($user->isManager()) {
                    $query->where(function ($q) use ($user) {
                        $q->whereIn('status', [Conversation::STATUS_BOT, Conversation::STATUS_QUEUED])
                            ->orWhere(function ($q2) use ($user) {
                                $q2->where('status', Conversation::STATUS_OPEN)
                                    ->where('assigned_user_id', $user->id);
                            });
                    });
                } else {
                    $query->visibleTo($user)->active();
                }

                // Só conta conversas com mensagens não lidas pelo atendente
                $query->whereHas('messages', function ($q) {
                    $q->where('direction', 'in')
                        ->whereRaw('(conversations.last_read_at IS NULL OR messages.created_at > conversations.last_read_at)');
                });

                return $query->count();
            },
            'internalChatBadgeCount' => function () use ($request) {
                $user = $request->user();
                if (! $user) {
                    return 0;
                }

                return app(InternalChatService::class)->totalUnreadCount($user);
            },
        ];
    }
}
