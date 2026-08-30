function clean(v){return String(v||'').trim()}
class BucketAdapter{
  constructor(env=process.env,storage=null){
    this.name=clean(env.SUPERVISOR_BUCKET_NAME);
    if(storage)this.storage=storage;
    else{const {Storage}=require('@google-cloud/storage');this.storage=new Storage(env.GOOGLE_CLOUD_PROJECT?{projectId:env.GOOGLE_CLOUD_PROJECT}:undefined)}
  }
  isConfigured(){return!!this.name}
  async validate(){if(!this.name)throw new Error('SUPERVISOR_BUCKET_NAME_NOT_CONFIGURED');const [exists]=await this.storage.bucket(this.name).exists();if(!exists)throw new Error('SUPERVISOR_BUCKET_NOT_FOUND');return{ok:true,name:this.name,exists:true,mode:'validation_only'}}
}
module.exports={BucketAdapter};
