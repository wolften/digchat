<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Mark all existing conversations as read so they don't flood with old unread counts.
        // Going forward, only messages after last_read_at accumulate as unread.
        DB::statement('UPDATE conversations SET last_read_at = NOW() WHERE last_read_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('UPDATE conversations SET last_read_at = NULL');
    }
};
