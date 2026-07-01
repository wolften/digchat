<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('conversation_tag')) {
            return;
        }

        $this->mergeIntoContactTags();

        Schema::dropIfExists('conversation_tag');
    }

    public function down(): void
    {
        Schema::create('conversation_tag', function (Blueprint $table) {
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['conversation_id', 'tag_id']);
            $table->timestamp('created_at')->useCurrent();
        });

        $now = now();

        DB::table('contact_tag')
            ->join('conversations', 'contact_tag.contact_id', '=', 'conversations.contact_id')
            ->selectRaw('conversations.id as conversation_id, contact_tag.tag_id')
            ->orderByDesc('conversations.id')
            ->get()
            ->unique(fn ($row) => $row->conversation_id.'-'.$row->tag_id)
            ->each(function ($row) use ($now): void {
                DB::table('conversation_tag')->insertOrIgnore([
                    'conversation_id' => $row->conversation_id,
                    'tag_id'          => $row->tag_id,
                    'created_at'      => $now,
                ]);
            });
    }

    private function mergeIntoContactTags(): void
    {
        if (! Schema::hasTable('contact_tag')) {
            return;
        }

        $now = now();

        DB::table('conversation_tag')
            ->join('conversations', 'conversation_tag.conversation_id', '=', 'conversations.id')
            ->selectRaw('conversations.contact_id, conversation_tag.tag_id')
            ->distinct()
            ->get()
            ->each(function ($row) use ($now): void {
                DB::table('contact_tag')->insertOrIgnore([
                    'contact_id' => $row->contact_id,
                    'tag_id'     => $row->tag_id,
                    'created_at' => $now,
                ]);
            });
    }
};