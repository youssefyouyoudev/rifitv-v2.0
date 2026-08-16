<?php

namespace App\Enums;

enum StreamProtocol: string
{
    case Hls = 'hls';
    case MpegTs = 'mpegts';

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $protocol): string => $protocol->value, self::cases());
    }
}
