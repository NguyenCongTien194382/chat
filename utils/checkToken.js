import jwt from "jsonwebtoken";

export const tokenPassword = ()=>{
    return "vfvjdfvbjfdbvffgbfubfugbfug"
}

// check can convert to data Obj 
// check expired 
export const checkToken = async (token) => {
    try{
        let user = await jwt.verify(token, tokenPassword() );
        // console.log('user token',user);
        if(user.UnCheckExpired){
            // console.log('user UnCheckExpired');
            return {
                userId:user._id,
                status:true
            }
        }
        if(new Date(user.timeExpried) > new Date()){
            return {
                userId:user._id,
                status:true
            }
        }
        else{
            return {
                userId:"",
                status:false
            }
        }

    }
    catch(e){
        console.log(e);
        return {
            userId:"",
            status:false
        }
    }
  };