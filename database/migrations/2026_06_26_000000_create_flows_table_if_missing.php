<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('flows')) {
            return;
        }

        Schema::create('flows', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->json('definition');
            $table->boolean('is_active')->default(false)->index();
            $table->boolean('is_default')->default(false)->index();
            $table->foreignId('sector_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        // This migration backfills a table that may already exist in deployed
        // databases, so rollback intentionally avoids dropping operational data.
    }
};
