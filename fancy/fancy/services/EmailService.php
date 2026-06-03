<?php

require_once __DIR__ . "/../config/mail.php";

function sendVerificationEmail($toEmail, $firstName, $code)
{
    if (MAIL_ENABLED === false) {
        return true;
    }

    $subject = "Email Verification Code";

    $message = "
    <html>
    <head>
        <title>Email Verification</title>
    </head>
    <body>
        <h2>Hello {$firstName},</h2>
        <p>Your verification code is:</p>
        <h1 style='letter-spacing: 4px;'>{$code}</h1>
        <p>This code will expire in 15 minutes.</p>
        <p>If you did not create this account, please ignore this email.</p>
    </body>
    </html>
    ";

    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8\r\n";
    $headers .= "From: " . MAIL_FROM_NAME . " <" . MAIL_FROM_EMAIL . ">\r\n";

    return mail($toEmail, $subject, $message, $headers);
}