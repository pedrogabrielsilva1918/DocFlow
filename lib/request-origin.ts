// developmentOrigin is injected by Vite only in development, never from request headers.
export function isAllowedOrigin(request:Request,developmentOrigin=''):boolean {
 const origin=request.headers.get('origin');
 const url=new URL(request.url);
 if(origin===url.origin)return true;
 if(!developmentOrigin||origin!==developmentOrigin)return false;
 const expected=new URL(developmentOrigin);
 return url.hostname===expected.hostname||['localhost','127.0.0.1','[::1]'].includes(url.hostname);
}
