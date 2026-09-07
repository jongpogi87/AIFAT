export type AorCode = "A"|"B"|"C"|"D"|"E"|"F"|"G"|"H"|"I"|"J"|"K"|"T";
export type BatchStatus = "OPEN"|"NEARLY FULL"|"FULL"|"REGISTRATION CLOSED"|"UPCOMING";
export type Batch = {
  batchId:string; classDesignation:string; aorName:string; aorCode:AorCode;
  deliveryMode:"Online"|"Face-to-Face"; session:"AM"|"PM";
  startDate:string; endDate:string; startTime:string; endTime:string;
  registrationDeadline:string|null; capacity:number|null; status:BatchStatus;
  venue:string; enabled:boolean;
};

export const AORS = [
  {name:"1ID AOR",code:"A"},{name:"2ID AOR",code:"B"},{name:"3ID AOR",code:"C"},
  {name:"4ID AOR",code:"D"},{name:"5ID AOR",code:"E"},{name:"6ID AOR",code:"F"},
  {name:"7ID AOR",code:"G"},{name:"8ID AOR",code:"H"},{name:"9ID AOR",code:"I"},
  {name:"10ID AOR",code:"J"},{name:"11ID AOR",code:"K"},{name:"NCR AOR",code:"T"},
] as const;

const dates = {startDate:"14 September 2026",endDate:"25 September 2026"};
export const BATCHES: Batch[] = AORS.flatMap(({name,code}) => {
  const sessions: Array<Pick<Batch,"deliveryMode"|"session"|"startTime"|"endTime"|"venue">> = [
    {deliveryMode:"Online",session:"AM",startTime:"0800H",endTime:"1200H",venue:"Online"},
    {deliveryMode:"Online",session:"PM",startTime:"1300H",endTime:"1700H",venue:"Online"},
    ...(code==="T" ? [
      {deliveryMode:"Face-to-Face" as const,session:"AM" as const,startTime:"0800H",endTime:"1200H",venue:"The Signal School, Fort Andres Bonifacio, Taguig City"},
      {deliveryMode:"Face-to-Face" as const,session:"PM" as const,startTime:"1300H",endTime:"1700H",venue:"The Signal School, Fort Andres Bonifacio, Taguig City"},
    ] : []),
  ];
  return sessions.map((item,index)=>({
    batchId:`${code.toLowerCase()}-${item.deliveryMode==="Online"?"online":"f2f"}-${item.session.toLowerCase()}`,
    classDesignation:`AIFAT Class ${code}${String(index+1).padStart(2,"0")}-2026`,
    aorName:name,aorCode:code,...item,...dates,
    registrationDeadline:null,capacity:25,status:"OPEN" as const,enabled:true,
  }));
});

export function getBatch(batchId:string){return BATCHES.find(batch=>batch.batchId===batchId&&batch.enabled);}
export function getAor(code:string){return AORS.find(aor=>aor.code===code);}
