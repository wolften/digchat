<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="app-timezone" content="{{ config('app.timezone', 'America/Sao_Paulo') }}">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
        @inertiaHead
        <script>
            (function () {
                var stored = localStorage.getItem('digchat-theme');
                var theme = stored === 'light' || stored === 'dark'
                    ? stored
                    : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
                if (theme === 'light') {
                    var vars = {
                        '--tint-deep': '200 240 218',
                        '--tint-dark': '226 249 237',
                        '--tint-mid': '140 210 174',
                        '--c-bg': '226 249 237',
                        '--c-ink': '3 10 6',
                        '--c-panel': '140 210 174',
                        '--shell-surface': 'rgba(255, 255, 255, 0.58)',
                        '--sidebar-surface': 'rgba(255, 255, 255, 0.44)',
                    };
                    Object.keys(vars).forEach(function(k) {
                        document.documentElement.style.setProperty(k, vars[k]);
                    });
                    document.documentElement.style.colorScheme = 'light';
                    document.documentElement.classList.add('light');
                } else {
                    document.documentElement.classList.add('dark');
                }
            })();
        </script>
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
