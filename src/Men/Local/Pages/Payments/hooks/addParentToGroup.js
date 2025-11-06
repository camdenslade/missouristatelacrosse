// src/Men/Local/Pages/Payments/hooks/addParentToGroup.js
import { addDoc, collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";

import { db } from "../../../../../Services/firebaseConfig.js";

export async function addParentToGroup(email) {
  if (!email) return;

  const groupsRef = collection(db, "groups");
  const q = query(groupsRef, where("name", "==", "Parents"));
  const snap = await getDocs(q);

  if (snap.empty){
    await addDoc(groupsRef, {
      name: "Parents",
      members: [email],
      createdAt: new Date(),
      createdBy: "system",
    });
    console.log("Created Parents group and added:", email);
  } else{
    const groupDoc = snap.docs[0];
    const groupData = groupDoc.data();
    const members = groupData.members || [];

    if (!members.includes(email)){
      await updateDoc(doc(db, "groups", groupDoc.id), {
        members: [...members, email],
      });
      console.log("Added parent to Parents group:", email);
    }
  }
}
