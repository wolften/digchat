<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Mark all existing conversations as read so they don't flood with old unread counts.
        // Going forward, only messages after last_read_at accumulate as unread.
        DB::table('conversations')
            ->whereNull('last_read_at')
            ->update(['last_read_at' => now()]);
    }

    public function down(): void
    {
        DB::table('conversations')->update(['last_read_at' => null]);
    }
};
