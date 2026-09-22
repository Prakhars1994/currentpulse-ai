import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime="nodejs";
type RazorpayOrder={id?:string};
function admin(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
async function userFrom(req:NextRequest){const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!token)return null;const {data}=await admin().auth.getUser(token);return data.user}
export async function POST(req:NextRequest){try{
 const user=await userFrom(req);if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const {productId}=await req.json();const db=admin();const {data:product,error}=await db.from("mains_products").select("id,name,price_paise,currency,product_type,test_credits").eq("id",productId).eq("active",true).single();if(error||!product)return NextResponse.json({error:"Product unavailable"},{status:404});
 const key=process.env.RAZORPAY_KEY_ID,secret=process.env.RAZORPAY_KEY_SECRET;if(!key||!secret)return NextResponse.json({error:"Payments are not activated yet"},{status:503});
 const receipt=`cp_${crypto.randomUUID().replaceAll("-","").slice(0,24)}`;const r=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,"Content-Type":"application/json"},body:JSON.stringify({amount:product.price_paise,currency:product.currency||"INR",receipt,notes:{currentpulse_user:user.id,product_id:product.id}})});const ro=await r.json() as RazorpayOrder;if(!r.ok||!ro.id)return NextResponse.json({error:"Payment provider rejected order"},{status:502});
 const {error:insertError}=await db.from("mains_orders").insert({user_id:user.id,product_id:product.id,amount_paise:product.price_paise,currency:product.currency||"INR",status:"created",provider:"razorpay",provider_order_id:ro.id});if(insertError)return NextResponse.json({error:"Could not record payment order"},{status:500});
 return NextResponse.json({keyId:key,orderId:ro.id,amount:product.price_paise,currency:product.currency||"INR",name:product.name,email:user.email});
 }catch{return NextResponse.json({error:"Could not create payment"},{status:500})}}
