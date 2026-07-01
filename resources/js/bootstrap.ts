import { cleanupStaleServiceWorkers } from '@/lib/cleanupServiceWorkers';
import axios from 'axios';

cleanupStaleServiceWorkers();

window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

import './echo';
