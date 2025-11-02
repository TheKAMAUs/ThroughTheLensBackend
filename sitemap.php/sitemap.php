<?php
header('Content-Type: application/xml');

// recognize domain
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$domain = $scheme . '://' . $host;

// logs
$logFile = __DIR__ . '/visited_paths.csv';
$entries = file_exists($logFile) ? file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];

echo '<?xml version="1.0" encoding="UTF-8"?>' . PHP_EOL;
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . PHP_EOL;

foreach ($entries as $entry) {
    [$path, $lastmod] = explode(',', $entry);

    $loc = htmlspecialchars($domain . $path, ENT_XML1);
    $lastmod = htmlspecialchars($lastmod);
    $changefreq = 'monthly';
    $priority = '0.8';

    echo "  <url>\n";
    echo "    <loc>$loc</loc>\n";
    echo "    <lastmod>$lastmod</lastmod>\n";
    echo "    <changefreq>$changefreq</changefreq>\n";
    echo "    <priority>$priority</priority>\n";
    echo "  </url>\n";
}

echo '</urlset>';

?>