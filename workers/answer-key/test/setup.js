import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';

await applyD1Migrations(env.ANSWER_KEYS,env.TEST_MIGRATIONS);
