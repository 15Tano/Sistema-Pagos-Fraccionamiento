<?php
namespace App\Services;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
class OneSignalService
{
    protected string $appId;
    protected string $restApiKey;
    protected string $baseUrl = 'https://onesignal.com/api/v1/notifications';
    public function __construct()
    {
        $this->appId = config('services.onesignal.app_id');
        $this->restApiKey = config('services.onesignal.rest_api_key');
    }
    /**
     * Notificación individual a un vecino específico.
     *
     * @param int|string $vecinoId  Debe ser el user.id (external_id), NO vecino_id
     */
    public function notifyUser(int|string $vecinoId, string $titulo, string $mensaje, ?string $url = null, array $data = []): array
    {
        $payload = [
            'app_id' => $this->appId,
            'include_aliases' => [
                'external_id' => [(string) $vecinoId],
            ],
            'target_channel' => 'push',
            'headings' => ['en' => $titulo],
            'contents' => ['en' => $mensaje],
        ];
        if ($url) {
            $payload['url'] = $url;
        }
        if (!empty($data)) {
            $payload['data'] = $data;
        }
        return $this->send($payload);
    }
    /**
     * Notificación masiva a todos los residentes (vía tag 'rol' = 'residente').
     */
    public function notifyAllResidents(string $titulo, string $mensaje, ?string $url = null, array $data = []): array
    {
        $payload = [
            'app_id' => $this->appId,
            'filters' => [
                ['field' => 'tag', 'key' => 'rol', 'relation' => '=', 'value' => 'residente'],
            ],
            'target_channel' => 'push',
            'headings' => ['en' => $titulo],
            'contents' => ['en' => $mensaje],
        ];
        if ($url) {
            $payload['url'] = $url;
        }
        if (!empty($data)) {
            $payload['data'] = $data;
        }
        return $this->send($payload);
    }
    protected function send(array $payload): array
    {
        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . $this->restApiKey,
            'Content-Type' => 'application/json; charset=utf-8',
        ])->post($this->baseUrl, $payload);
        if ($response->failed()) {
            Log::error('OneSignal notification failed', [
                'payload' => $payload,
                'response' => $response->json(),
                'status' => $response->status(),
            ]);
        }
        return $response->json() ?? [];
    }
}
