import { withSupabase } from "npm:@supabase/server@1";

type SevenRole = "supervisor"|"director"|"manager"|"reception"|"housekeeping"|"accountant";
const STAFF = new Set<SevenRole>(["reception","housekeeping","accountant"]);
const ALL = new Set<SevenRole>(["supervisor","director","manager","reception","housekeeping","accountant"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern=/^[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{2,40}$/;

export default {
  fetch: withSupabase({auth:"user"},async(req,ctx)=>{
    if(req.method!=="POST")return Response.json({ok:false,error:"method_not_allowed"},{status:405});
    const actor=ctx.userClaims?.id;
    if(!actor)return Response.json({ok:false,error:"not_authenticated"},{status:401});

    let body:Record<string,unknown>;
    try{body=await req.json();}catch{return Response.json({ok:false,error:"invalid_json"},{status:400});}
    if(!body||typeof body!=="object")
      return Response.json({ok:false,error:"invalid_input"},{status:400});

    const email=String(body.email||"").trim().toLowerCase();
    const fullName=String(body.full_name||"").trim();
    const role=String(body.role||"") as SevenRole;
    const hotelId=body.hotel_id==null?null:String(body.hotel_id);

    if(email.length>200||!emailPattern.test(email)||
       fullName.length<2||fullName.length>160||!ALL.has(role))
      return Response.json({ok:false,error:"invalid_input"},{status:422});

    const {data:assigned,error:roleError}=await ctx.supabase
      .from("seven_roles")
      .select("role,hotel_id")
      .eq("user_id",actor)
      .eq("active",true);
    if(roleError||!assigned?.length)
      return Response.json({ok:false,error:"forbidden"},{status:403});

    const supervisor=assigned.some(x=>x.role==="supervisor");
    const director=assigned.some(x=>x.role==="director");
    const managerHotels=new Set(
      assigned.filter(x=>x.role==="manager"&&x.hotel_id).map(x=>x.hotel_id)
    );

    const global=role==="supervisor"||role==="director";
    if(global&&hotelId!==null)
      return Response.json({ok:false,error:"global_role_has_no_hotel"},{status:422});
    if(!global&&(!hotelId||!uuid.test(hotelId)))
      return Response.json({ok:false,error:"hotel_required"},{status:422});

    const canInvite=supervisor
      ||(director&&role!=="supervisor")
      ||(STAFF.has(role)&&!!hotelId&&managerHotels.has(hotelId));
    if(!canInvite)return Response.json({ok:false,error:"forbidden"},{status:403});

    if(hotelId){
      const {data:hotel,error:hotelError}=await ctx.supabase
        .from("hotels").select("id").eq("id",hotelId).maybeSingle();
      if(hotelError||!hotel)
        return Response.json({ok:false,error:"invalid_hotel"},{status:422});
    }

    // The administrative client stays only in this Edge Function.
    // Authorization is verified from fresh server-side seven_roles rows,
    // never from editable user_metadata or a client-provided "is_admin" flag.
    const invited=await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email,{
      data:{full_name:fullName}
    });
    if(invited.error||!invited.data?.user?.id){
      console.error("Seven invitation provider error",invited.error?.code||"unknown");
      return Response.json({ok:false,error:"invitation_not_sent"},{status:409});
    }
    const userId=invited.data.user.id;

    // RLS still validates the actor's right to assign the requested role,
    // even after the Auth admin invitation has been created.
    const {error:accessError}=await ctx.supabase.from("seven_roles").insert({
      user_id:userId,hotel_id:global?null:hotelId,role,full_name:fullName
    });
    if(accessError){
      // Avoid deleting a potentially pre-existing Auth account here.
      // The invited user has no new ERP privileges; an administrator can
      // attach a role from the "existing account" form after verification.
      console.error("Seven invite role assignment failed",accessError.code||"unknown");
      return Response.json({ok:false,error:"invite_sent_role_assignment_pending"},{status:409});
    }
    return Response.json({ok:true,role,hotel_id:global?null:hotelId});
  })
};
