<?php

function getJsonInput()
{
    $input = json_decode(file_get_contents("php://input"), true);

    if (!is_array($input)) {
        return [];
    }

    return $input;
}

function cleanInput($value)
{
    return trim(htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8'));
}

function isValidEmail($email)
{
    return filter_var($email, FILTER_VALIDATE_EMAIL);
}

function generateVerificationCode()
{
    return (string) random_int(100000, 999999);
}

function startSessionIfNotStarted()
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

function createSlug($text)
{
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9]+/i', '-', $text);
    $text = trim($text, '-');

    if ($text === '') {
        $text = 'item';
    }

    return $text;
}