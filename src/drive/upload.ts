
export async function uploadToDrive(token:string,file:Blob,name:string){
    const metadata={name};
    const form=new FormData();
    form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
    form.append('file',file);

    const r=await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
    method:'POST',
    headers:{Authorization:`Bearer ${token}`},
    body:form
    });
    return r.json();
}
