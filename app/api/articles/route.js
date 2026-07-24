import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req) {
  try {

    const body = await req.json();

    const {
      title,
      category,
      paper,
      why_news,
      prelims,
      mains,
      question,
    } = body;


    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-") 
      + "-" + Date.now();


    const { data, error } = await supabase
      .from("articles")
      .insert([
        {
          slug,
          title,
          category,
          paper,
          why_news,
          prelims,
          mains,
          question,
        },
      ])
      .select();


    if(error){

      console.log(error);

      return NextResponse.json(
        {
          success:false,
          error:error.message
        },
        {status:500}
      );
    }


    return NextResponse.json({
      success:true,
      message:"Article Published Successfully",
      article:data[0]
    });


  } catch(err){

    return NextResponse.json(
      {
        success:false,
        message:err.message
      },
      {status:500}
    );

  }
}