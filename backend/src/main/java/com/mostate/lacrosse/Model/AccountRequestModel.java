package com.mostate.lacrosse.Model;

public class AccountRequestModel {
    private String id;
    private String email;
    private String displayName;
    private String status;
    private String uid;
    private String program;

    public AccountRequestModel(){
        this.status = "pending";
        this.program = "men";
    }

    public AccountRequestModel(String email, String displayName){
        this.email = email;
        this.displayName = displayName;
        this.status = "pending";
        this.program = "men";
    }

    public String getId() {return id;}
    public void setId(String id) {this.id = id;}

    public String getEmail() {return email;}
    public void setEmail(String email) {this.email = email;}

    public String getDisplayName() {return displayName;}
    public void setDisplayName(String displayName) {this.displayName = displayName;}

    public String getStatus() {return status;}
    public void setStatus(String status) {this.status = status;}

    public String getProgram() {return program;}
    public void setProgram(String program) {
        // Checks with frontend to determine if program = women, otherwise defaults.
        if (program == null || program.isEmpty()){
            this.program = "men";
        } else{
            this.program = program.toLowerCase();
        }
    }
}
