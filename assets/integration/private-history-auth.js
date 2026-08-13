import {PRIVATE_HISTORY_CONFIG} from './private-history-config.js?v=1.1.0';
const VERSION='12.16.0';
const APP_SDK=`https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js`;
const AUTH_SDK=`https://www.gstatic.com/firebasejs/${VERSION}/firebase-auth.js`;
let appPromise=null,authPromise=null;

function configured(){const c=PRIVATE_HISTORY_CONFIG.firebaseConfig||{};return PRIVATE_HISTORY_CONFIG.enabled===true&&PRIVATE_HISTORY_CONFIG.provider==='firebase'&&c.apiKey&&c.authDomain&&c.projectId&&c.appId}
export function privateHistoryEnabled(){return Boolean(configured())}
export async function privateHistoryApp(){
 if(!privateHistoryEnabled())throw new Error('Persistência privada Firebase ainda não configurada.');
 if(!appPromise)appPromise=import(APP_SDK).then(({initializeApp,getApp,getApps})=>getApps().length?getApp():initializeApp(PRIVATE_HISTORY_CONFIG.firebaseConfig));
 return appPromise;
}
export async function privateHistoryAuth(){
 if(!authPromise)authPromise=Promise.all([privateHistoryApp(),import(AUTH_SDK)]).then(async([app,mod])=>{const auth=mod.getAuth(app);try{await mod.setPersistence(auth,mod.browserLocalPersistence)}catch{}if(typeof auth.authStateReady==='function')await auth.authStateReady();return{auth,mod}});
 return authPromise;
}
const sessionFrom=user=>user?{user:{id:user.uid,email:user.email||null,emailVerified:user.emailVerified===true}}:null;
export async function getPrivateSession(){const{auth}=await privateHistoryAuth();return sessionFrom(auth.currentUser)}
export async function signInPrivate(email,password){const{auth,mod}=await privateHistoryAuth();const credential=await mod.signInWithEmailAndPassword(auth,String(email).trim(),String(password));return sessionFrom(credential.user)}
export async function signUpPrivate(email,password){const{auth,mod}=await privateHistoryAuth();const credential=await mod.createUserWithEmailAndPassword(auth,String(email).trim(),String(password));return sessionFrom(credential.user)}
export async function signOutPrivate(){const{auth,mod}=await privateHistoryAuth();await mod.signOut(auth);return true}
