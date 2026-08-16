<?php

namespace App\Services;

class M3uParser
{
    /** @return list<array{name:string,url:string,external_id:?string,group:?string,logo:?string,metadata:array<string,string>}> */
    public function parse(string $content): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $content) ?: [];
        $entries = [];
        $pending = null;

        foreach ($lines as $line) {
            $line = trim($line);

            if ($line === '' || $line === '#EXTM3U') {
                continue;
            }

            if (str_starts_with($line, '#EXTINF:')) {
                $pending = $this->parseInf($line);

                continue;
            }

            if (! str_starts_with($line, '#') && $pending) {
                $pending['url'] = $line;
                $entries[] = $pending;
                $pending = null;
            }
        }

        return $entries;
    }

    /** @return array{name:string,url:string,external_id:?string,group:?string,logo:?string,metadata:array<string,string>} */
    private function parseInf(string $line): array
    {
        $metadata = [];

        preg_match_all('/([\w-]+)="([^"]*)"/', $line, $matches, PREG_SET_ORDER);
        foreach ($matches as $match) {
            $metadata[$match[1]] = $match[2];
        }

        $comma = strrpos($line, ',');
        $name = $comma === false ? ($metadata['tvg-name'] ?? 'Unnamed Channel') : trim(substr($line, $comma + 1));
        $name = $name !== '' ? $name : ($metadata['tvg-name'] ?? 'Unnamed Channel');

        return [
            'name' => $name,
            'url' => '',
            'external_id' => $metadata['tvg-id'] ?? null,
            'group' => $metadata['group-title'] ?? null,
            'logo' => $metadata['tvg-logo'] ?? null,
            'metadata' => $metadata,
        ];
    }
}
