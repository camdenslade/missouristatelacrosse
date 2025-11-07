package com.mostate.lacrosse.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import org.springframework.stereotype.Repository;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.WriteResult;
import com.google.firebase.cloud.FirestoreClient;
import com.mostate.lacrosse.Model.AccountRequestModel;

@Repository
public class AccountRequestRepo {
    private Firestore firestore;
    private Firestore getFirestore(){
        if (firestore == null){
            firestore = FirestoreClient.getFirestore();
        }
        return firestore;
    }

    public String save(AccountRequestModel requestModel) throws ExecutionException, InterruptedException {
        if (requestModel.getProgram() == null || requestModel.getProgram().isEmpty()) {
            requestModel.setProgram("men"); 
        }

        DocumentReference docRef = getFirestore().collection("accountRequests").document();
        requestModel.setId(docRef.getId());
        ApiFuture<WriteResult> result = docRef.set(requestModel);
        result.get(); 
        return requestModel.getId();
    }

    public List<AccountRequestModel> findAll(String program) throws ExecutionException, InterruptedException {
        CollectionReference colRef = getFirestore().collection("accountRequests");

        ApiFuture<QuerySnapshot> future;
        if (program != null && !program.equalsIgnoreCase("all") && !program.isEmpty()){
            future = colRef.whereEqualTo("program", program.toLowerCase()).get();
        } else{
            future = colRef.get();
        }

        List<QueryDocumentSnapshot> documents = future.get().getDocuments();
        List<AccountRequestModel> requests = new ArrayList<>();

        for (QueryDocumentSnapshot doc : documents){
            AccountRequestModel req = doc.toObject(AccountRequestModel.class);
            req.setId(doc.getId());
            requests.add(req);
        }
        return requests;
    }


    public AccountRequestModel findById(String id) throws ExecutionException, InterruptedException {
        DocumentReference docRef = getFirestore().collection("accountRequests").document(id);
        DocumentSnapshot snapshot = docRef.get().get();

        if (snapshot.exists()){
            AccountRequestModel req = snapshot.toObject(AccountRequestModel.class);
            if (req != null) req.setId(snapshot.getId());
            return req;
        }
        return null;
    }

    public void updateStatus(String id, String status) throws ExecutionException, InterruptedException {
        getFirestore().collection("accountRequests")
                .document(id)
                .update("status", status)
                .get();
    }

    public void updateField(String id, String field, Object value) throws ExecutionException, InterruptedException {
        getFirestore().collection("accountRequests")
                .document(id)
                .update(field, value)
                .get();
    }

    public void delete(String id) throws ExecutionException, InterruptedException {
        getFirestore().collection("accountRequests")
                .document(id)
                .delete()
                .get();
    }
}
