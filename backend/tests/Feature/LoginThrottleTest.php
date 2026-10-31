<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class LoginThrottleTest extends TestCase
{
    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:',
            'cache.default' => 'array']);
        DB::purge('sqlite');
        (require database_path('migrations/2026_10_23_210000_create_control_acceso_ingestion_tables.php'))->up();
        $this->token = 'sica_'.str_repeat('a', 64);
        DB::table('control_acceso_agentes')->insert([
            'id' => '10000000-0000-4000-8000-000000000001', 'nombre' => 'Fixture',
            'device_serial' => 'TEST-C3', 'token_hash' => hash('sha256', $this->token),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.15']);
    }

    public function test_agent_traffic_does_not_consume_login_attempts_from_the_same_ip(): void
    {
        for ($i = 0; $i < 8; $i++) {
            // Empty payloads pass agent authentication and throttling, then fail validation.
            $this->postJson('/api/control-acceso/agente/estado', [], [
                'Authorization' => 'Bearer '.$this->token,
            ])->assertUnprocessable();
        }

        $this->postJson('/api/login', [])->assertUnprocessable()
            ->assertHeader('X-RateLimit-Remaining', '4');
    }

    public function test_login_still_blocks_the_sixth_attempt_and_recovers_after_one_minute(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', [])->assertUnprocessable();
        }
        $this->postJson('/api/login', [])->assertStatus(429)->assertHeader('Retry-After');

        $this->travel(61)->seconds();
        $this->postJson('/api/login', [])->assertUnprocessable()
            ->assertHeader('X-RateLimit-Remaining', '4');
    }

    public function test_a_blocked_ip_does_not_block_another_ip(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', [])->assertUnprocessable();
        }
        $this->postJson('/api/login', [])->assertStatus(429);

        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.16']);
        $this->postJson('/api/login', [])->assertUnprocessable()
            ->assertHeader('X-RateLimit-Remaining', '4');
    }
}
