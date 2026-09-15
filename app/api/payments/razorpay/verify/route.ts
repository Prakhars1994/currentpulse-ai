import { createHmac,timingSafeEqual } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
function admin(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
async function userFrom(req:NextRequest){const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!token)return null;const {data}=await admin().auth.getUser(token);return data.user}
function same(a:string,b:string){try{const aa=Buffer.from(a,"hex"),bb=Buffer.from(b,"hex");return aa.length===bb.length&&timingSafeEqual(aa,bb)}catch{return false}}
export async function POST(req:NextRequest){try{
 const user=await userFrom(req);if(!user)return NextResponse.json({error:"Sign in required"},{status:401});const secret=process.env.RAZORPAY_KEY_SECRET;if(!secret)return NextResponse.json({error:"Payments are not activated yet"},{status:503});
 const {razorpay_order_id,razorpay_payment_id,razorpay_signature}=await req.json();if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature)return NextResponse.json({error:"Incomplete payment proof"},{status:400});const expected=createHmac("sha256",secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");if(!same(expected,razorpay_signature))return NextResponse.json({error:"Invalid payment signature"},{status:400});
 const db=admin();const {data:order}=await db.from("mains_orders").select("id,user_id,product_id,status").eq("provider","razorpay").eq("provider_order_id",razorpay_order_id).eq("user_id",user.id).single();if(!order)return NextResponse.json({error:"Payment order not found"},{status:404});
 if(order.status!=="paid"){const {error:uerr}=await db.from("mains_orders").update({status:"paid",provider_payment_id:razorpay_payment_id,paid_at:new Date().toISOString()}).eq("id",order.id).eq("user_id",user.id);if(uerr)return NextResponse.json({error:"Could not finalize payment"},{status:500});}
 const {data:existing}=await db.from("mains_entitlements").select("id").eq("order_id",order.id).maybeSingle();if(!existing){const {data:product}=await db.from("mains_products").select("test_credits").eq("id",order.product_id).single();const {error:eerr}=await db.from("mains_entitlements").insert({user_id:user.id,product_id:order.product_id,order_id:order.id,credits_granted:product?.test_credits||0,credits_used:0});if(eerr&&eerr.code!=="23505")return NextResponse.json({error:"Payment verified but entitlement grant needs support"},{status:500});}
 return NextResponse.json({ok:true,orderId:order.id});
 }catch{return NextResponse.json({error:"Could not verify payment"},{status:500})}}
