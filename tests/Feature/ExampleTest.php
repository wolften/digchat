<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    public function test_the_application_redirects_guests_to_login(): void
    {
        // A raiz redireciona para o dashboard, que exige autenticação.
        $this->get('/')->assertRedirect();
        $this->get('/dashboard')->assertRedirect('/login');
    }
}
