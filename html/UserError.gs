class UserError extends Error {
  constructor(payload) {
    // Pass the message to the base Error class
    super(
      JSON.stringify({payload})
    );
    
    // Set the name property to the class name
    this.name = this.constructor.name;
  }
}