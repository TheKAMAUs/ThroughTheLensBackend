<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$path = null;

// Получаем путь из GET или POST JSON
if ($method === 'GET') {
    $path = $_GET['path'] ?? null;
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $path = $input['path'] ?? null;
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!$path) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing path']);
    exit;
}

// Очищаем путь от query-параметров
$path = parse_url($path, PHP_URL_PATH);
$logFile = __DIR__ . '/visited_paths.csv';

// Проверка: уже есть путь?
$exists = false;
if (file_exists($logFile)) {
    $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        [$savedPath,] = explode(',', $line);
        if ($savedPath === $path) {
            $exists = true;
            break;
        }
    }
}

if (!$exists) {
    $date = date('Y-m-d');
    file_put_contents($logFile, "$path,$date\n", FILE_APPEND | LOCK_EX);
    updateSitemap();
    echo json_encode(['status' => 'added', 'path' => $path]);
} else {
    echo json_encode(['status' => 'exists', 'path' => $path]);
}

// 📄 Обновление sitemap.xml
function updateSitemap() {
    $domain = $_SERVER['HTTP_HOST'];
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
    $baseUrl = "$protocol://$domain";

    $file = __DIR__ . '/visited_paths.csv';
    $sitemap = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    $sitemap .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

    if (file_exists($file)) {
        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            [$path, $date] = explode(',', $line);
            $loc = htmlspecialchars($baseUrl . $path);
            $sitemap .= "  <url>\n";
            $sitemap .= "    <loc>$loc</loc>\n";
            $sitemap .= "    <lastmod>$date</lastmod>\n";
            $sitemap .= "    <changefreq>weekly</changefreq>\n";
            $sitemap .= "    <priority>0.5</priority>\n";
            $sitemap .= "  </url>\n";
        }
    }

    $sitemap .= '</urlset>';
    file_put_contents(__DIR__ . '/sitemap.xml', $sitemap);
}

?>