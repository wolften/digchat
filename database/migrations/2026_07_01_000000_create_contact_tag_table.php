<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_tag', function (Blueprint $table) {
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['contact_id', 'tag_id']);
            $table->timestamp('created_at')->useCurrent();
        });

        $this->backfillFromConversations();
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_tag');
    }

    private function backfillFromConversations(): void
    {
        $latestByContact = DB::table('conversation_tag')
            ->join('conversations', 'conversation_tag.conversation_id', '=', 'conversations.id')
            ->selectRaw('conversations.contact_id, MAX(conversations.id) as conversation_id')
            ->groupBy('conversations.contact_id')
            ->get();

        if ($latestByContact->isEmpty()) {
            return;
        }

        $now = now();
        $rows = [];

        foreach ($latestByContact as $entry) {
            $tagIds = DB::table('conversation_tag')
                ->where('conversation_id', $entry->conversation_id)
                ->pluck('tag_id');

            foreach ($tagIds as $tagId) {
                $rows[] = [
                    'contact_id' => $entry->contact_id,
                    'tag_id'     => $tagId,
                    'created_at' => $now,
                ];
            }
        }

        if ($rows !== []) {
            DB::table('contact_tag')->insert($rows);
        }
    }
};