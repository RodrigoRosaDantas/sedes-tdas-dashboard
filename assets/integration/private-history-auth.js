import {PRIVATE_HISTORY_CONFIG} from './private-history-config.js?v=1.0.0';
import {AUTH_STORAGE_KEY} from './persistence-contract.js?v=1.0.0';
const SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm';
let clientPromise=null;
export function privateHistoryEnabled(){return PRIVATE_HISTORY_CONFIG.enabled===true&&/^https:\/\//.test(PRIVATE_HISTORY_CONFIG.projectUrl)&&String(PRIVATE_HISTORY_CONFIG.publishableKey).startsWith('sb_publishable_')}
export async function privateHistoryClient(){
 if(!privateHistoryEnabled())throw new Error('Persistência privada ainda não configurada.');
 if(!clientPromise)clientPromise=import(SDK).then(({createClient})=>createClient(PRIVATE_HISTORY_CONFIG.projectUrl,PRIVATE_HISTORY_CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:AUTH_STORAGE_KEY}}));
 return clientPromise;
}
export async function getPrivateSession(){const client=await privateHistoryClient(),{data,error}=await client.auth.getSession();if(error)throw error;return data.session||null}
export async function signInPrivate(email,password){const client=await privateHistoryClient(),{data,error}=await client.auth.signInWithPassword({email:String(email).trim(),password:String(password)});if(error)throw error;return data.session||null}
export async function signUpPrivate(email,password){const client=await privateHistoryClient(),{data,error}=await client.auth.signUp({email:String(email).trim(),password:String(password)});if(error)throw error;return data.session||null}
export async function signOutPrivate(){const client=await privateHistoryClient(),{error}=await client.auth.signOut();if(error)throw error;return true}
