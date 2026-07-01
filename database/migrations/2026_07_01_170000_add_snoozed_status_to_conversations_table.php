<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        DB::statement(
            "ALTER TABLE `conversations` MODIFY `status` ENUM('bot', 'queued', 'open', 'closed', 'surveying', 'snoozed') NOT NULL DEFAULT 'bot'"
        );
    }

    public function down(): void
    {
        if (! in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        DB::statement(
            "ALTER TABLE `conversations` MODIFY `status` ENUM('bot', 'queued', 'open', 'closed') NOT NULL DEFAULT 'bot'"
        );
    }
};