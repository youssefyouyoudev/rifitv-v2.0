<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use DateTimeInterface;
use InvalidArgumentException;

class MatchDateWindowService
{
    public const DEFAULT_TIMEZONE = 'Africa/Casablanca';

    public const FOOTBALL_DAY_START_HOUR = 6;

    public function timezone(): string
    {
        return (string) config('rifitv.display_timezone', self::DEFAULT_TIMEZONE);
    }

    public function today(): string
    {
        return $this->dateForInstant(CarbonImmutable::now('UTC'));
    }

    public function dateForInstant(DateTimeInterface|string $value): string
    {
        $local = $value instanceof DateTimeInterface
            ? CarbonImmutable::instance($value)->setTimezone($this->timezone())
            : CarbonImmutable::parse($value, $this->timezone());

        if ($local->hour < self::FOOTBALL_DAY_START_HOUR) {
            $local = $local->subDay();
        }

        return $local->toDateString();
    }

    /** @return array{date:string,timezone:string,start:CarbonImmutable,end:CarbonImmutable} */
    public function bounds(string $date): array
    {
        $date = $this->normalizeDate($date);
        $timezone = $this->timezone();
        $start = CarbonImmutable::createFromFormat('!Y-m-d H:i:s', $date.' 06:00:00', $timezone);

        if (! $start) {
            throw new InvalidArgumentException("Invalid football date [{$date}].");
        }

        $nextStart = $start->addDay();

        return [
            'date' => $date,
            'timezone' => $timezone,
            'start' => $start->utc(),
            'end' => $nextStart->subMicrosecond()->utc(),
        ];
    }

    public function normalizeDate(?string $date): string
    {
        if ($date === null || $date === '' || $date === 'today') {
            return $this->today();
        }

        if ($date === 'tomorrow') {
            return $this->addDays($this->today(), 1);
        }

        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return $this->today();
        }

        try {
            $parsed = CarbonImmutable::createFromFormat('!Y-m-d', $date, $this->timezone());
        } catch (InvalidArgumentException) {
            return $this->today();
        }

        return $parsed && $parsed->format('Y-m-d') === $date ? $date : $this->today();
    }

    public function addDays(string $date, int $amount): string
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', $this->normalizeDate($date), $this->timezone())
            ->addDays($amount)
            ->toDateString();
    }
}
