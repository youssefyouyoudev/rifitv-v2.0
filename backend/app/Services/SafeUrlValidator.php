<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

class SafeUrlValidator
{
    /** @var array<string,bool> */
    private array $hostSafetyCache = [];

    public function ensurePublicHttpUrl(?string $url, string $field = 'url'): string
    {
        $url = trim((string) $url);

        if (! filter_var($url, FILTER_VALIDATE_URL)) {
            throw ValidationException::withMessages([$field => ['Enter a valid URL.']]);
        }

        $parts = parse_url($url);
        $scheme = strtolower($parts['scheme'] ?? '');
        $host = strtolower(trim($parts['host'] ?? '', '[]'));

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw ValidationException::withMessages([$field => ['Only public HTTP or HTTPS URLs are allowed.']]);
        }

        if ($this->isBlockedHost($host)) {
            throw ValidationException::withMessages([$field => ['Private, local, and metadata URLs are not allowed.']]);
        }

        return $url;
    }

    private function isBlockedHost(string $host): bool
    {
        if (array_key_exists($host, $this->hostSafetyCache)) {
            return $this->hostSafetyCache[$host];
        }

        if (in_array($host, ['localhost', 'localhost.localdomain'], true) || str_ends_with($host, '.local')) {
            return $this->hostSafetyCache[$host] = true;
        }

        $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);

        if (! filter_var($ip, FILTER_VALIDATE_IP)) {
            return $this->hostSafetyCache[$host] = false;
        }

        return $this->hostSafetyCache[$host] = ! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    }
}
