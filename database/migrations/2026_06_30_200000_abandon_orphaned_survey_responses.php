<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Mark in_progress survey_responses as abandoned when their conversation
        // is already closed — these were orphaned by forceClose() not calling abandon.
        DB::statement("
            UPDATE survey_responses sr
            JOIN conversations c ON c.id = sr.conversation_id
            SET sr.status = 'abandoned'
            WHERE sr.status = 'in_progress'
              AND c.status = 'closed'
        ");
    }

    public function down(): void
    {
        // Not reversible — we cannot distinguish intentionally-abandoned from orphaned.
    }
};
