<?php

namespace App\Contracts;

use Illuminate\Http\UploadedFile;

interface MessagingChannel
{
    public function sendText(string $to, string $body): ?string;

    /**
     * @param  array<int, array{id: string, title: string}>  $buttons
     */
    public function sendButtons(string $to, string $body, array $buttons, ?string $header = null): ?string;

    /**
     * @param  array<int, array{id: string, title: string, description?: string}>  $rows
     */
    public function sendList(string $to, string $body, string $buttonText, array $rows, ?string $sectionTitle = null): ?string;

    public function sendFile(string $to, UploadedFile $file, string $type, ?string $caption = null, ?string $filename = null, ?string $forcedMimeType = null): ?string;

    public function supportsMediaFetch(): bool;

    public function markAsRead(string $messageId): bool;

    public function isConfigured(): bool;

    public function getLastErrorMessage(): ?string;
}
