const priority = ["CANDIDATE", "STUDENT", "FACULTY", "PROCTOR", "ADMIN"];
const roles = ["ADMIN", "PROCTOR"];
console.log(priority.find((role) => roles.includes(role)));
