<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->timestamp('snoozed_until')->nullable()->after('first_response_at');
            $table->foreignId('snoozed_by_user_id')->nullable()->after('snoozed_until')->constrained('users')->nullOnDelete();
            $table->string('snooze_note', 500)->nullable()->after('snoozed_by_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('snoozed_by_user_id');
            $table->dropColumn(['snoozed_until', 'snooze_note']);
        });
    }
};