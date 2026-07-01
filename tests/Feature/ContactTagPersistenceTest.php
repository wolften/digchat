<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContactTagPersistenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_tags_persist_on_contact_across_conversations(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $tag = Tag::create(['name' => 'VIP', 'color' => 'gold', 'is_active' => true]);

        $contact = Contact::create([
            'wa_id'        => '5547999990001',
            'profile_name' => 'Cliente VIP',
        ]);

        $conversation = $contact->conversations()->create([
            'status'           => Conversation::STATUS_OPEN,
            'assigned_user_id' => $atendente->id,
            'last_message_at'  => now()->subHour(),
        ]);

        $this->actingAs($atendente)
            ->put(route('inbox.conversations.tags', $conversation), [
                'tag_ids' => [$tag->id],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('contact_tag', [
            'contact_id' => $contact->id,
            'tag_id'     => $tag->id,
        ]);

        $conversation->update(['status' => Conversation::STATUS_CLOSED, 'assigned_user_id' => null]);

        $newConversation = $contact->conversations()->create([
            'status'          => Conversation::STATUS_QUEUED,
            'last_message_at' => now(),
        ]);

        $newConversation->load('contact.tags');

        $this->assertTrue($newConversation->contact->tags->contains('id', $tag->id));
    }

    public function test_removing_tag_from_conversation_updates_contact(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $tag = Tag::create(['name' => 'Suporte', 'color' => 'blue', 'is_active' => true]);

        $contact = Contact::create([
            'wa_id'        => '5547999990002',
            'profile_name' => 'Cliente',
        ]);

        $contact->tags()->sync([$tag->id]);

        $conversation = $contact->conversations()->create([
            'status'           => Conversation::STATUS_OPEN,
            'assigned_user_id' => $atendente->id,
            'last_message_at'  => now(),
        ]);

        $this->actingAs($atendente)
            ->put(route('inbox.conversations.tags', $conversation), [
                'tag_ids' => [],
            ])
            ->assertRedirect();

        $this->assertDatabaseMissing('contact_tag', [
            'contact_id' => $contact->id,
            'tag_id'     => $tag->id,
        ]);
    }
}