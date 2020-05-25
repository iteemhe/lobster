import backend
from flask import Flask,url_for, render_template,redirect, request
import flask
import time
import requests
import os,binascii

def verify_login(func):
    def wrapper(**kwargs):
        if 'Authorization' not in request.headers:
            return flask.abort(403)
        if request.headers['Authorization'].split(" ")[0] != "Token":
            return flask.abort(403)
        token = request.headers['Authorization'].split(" ")[1]
        cur = backend.conn.cursor()
        cur.execute("SELECT email from users where token = %s",(token,))
        response = cur.fetchone()
        if response == None:
            return flask.abort(403)
        cur.close()
        return func(*kwargs.values(),response[0])
    wrapper.__name__ = func.__name__
    return wrapper

@backend.app.route('/courses/<courseid>/exercises/', methods = ['GET'])
@verify_login
def get_course_exercises(courseid,email):
    cur = backend.conn.cursor()
    cur.execute("SELECT * from exercises where courseid = %s",(courseid))
    exercises = cur.fetchall()
    output = []
    for exercise in exercises:
        cur.execute("SELECT filename from starter_files where exerciseid = %s",(exercise[0],))
        files = cur.fetchall()
        files = [file[0] for file in files]
        output.append({"exerciseid":exercise[0],"courseid":exercise[1],"lastmodified":exercise[2],"datecreated":exercise[3],"numusers":exercise[4],"name":exercise[5],"files":files})
    cur.close()
    return flask.jsonify(output)

@backend.app.route('/exercises/<exerciseid>/', methods = ['GET'])
@verify_login
def get_exercise(exerciseid,email):
    print(exerciseid)
    cur = backend.conn.cursor()
    cur.execute("SELECT * from exercises where exerciseid = %s",(exerciseid,))
    exercise = cur.fetchone()
    cur.execute("SELECT filename from starter_files where exerciseid = %s",(exercise[0],))
    files = cur.fetchall()
    files = [file[0] for file in files]
    output = {"exerciseid":exercise[0],"courseid":exercise[1],"lastmodified":exercise[2],"datecreated":exercise[3],"numusers":exercise[4],"name":exercise[5],"files":files}
    cur.close()
    return flask.jsonify(output)

#TODO: Add post endpoint for course/courseid/exercises/

@backend.app.route('/exercises/', methods = ['POST'])
@verify_login
def add_exercise(email):
    new_exercise = request.form
    print(new_exercise)
    cur = backend.conn.cursor()
    # file_contents = request.files['file'].read()
    cur.execute("INSERT INTO exercises (courseid, name) VALUES (%s,%s) RETURNING exerciseid",(new_exercise["courseid"],new_exercise["name"]))
    backend.conn.commit()
    exerciseid = cur.fetchone()[0]
    cur.execute("SELECT * from exercises where exerciseid = %s",[exerciseid])
    exercise = cur.fetchone()
    output = {"exerciseid":exercise[0],"courseid":exercise[1],"lastmodified":exercise[2],"datecreated":exercise[3],"numusers":exercise[4],"name":exercise[5]}
    # cur.execute("insert into starter_files (exerciseid, filename, filecontents) VALUES (%s,%s,%s)",(exerciseid,new_exercise["file"]["filename"],new_exercise["file"]["contents"]))
    # backend.conn.commit()
    # output["files"] = new_exercise["file"]["filename"]
    cur.close()
    return output, 201

@backend.app.route('/exercises/<exerciseid>/', methods = ['PATCH'])
@verify_login
def edit_exercise(exerciseid,email):
    pass

@backend.app.route('/exercises/<exerciseid>/', methods = ['DELETE'])
@verify_login
def delete_exercise(exerciseid,email):
    cur = backend.conn.cursor()
    cur.execute("Delete from exercises where exerciseid = %s cascade",(exerciseid,))
    backend.conn.commit()
    cur.close()
    return {},204

@backend.app.route('/exercises/<exerciseid>/starter_files/', methods = ['GET'])
@verify_login
def get_starter_files(exerciseid,email):
    cur = backend.conn.cursor()
    cur.execute("SELECT filename from starter_files where exerciseid = %s",(exerciseid,))
    files = cur.fetchall()
    files = [file[0] for file in files]
    cur.close()
    return flask.jsonify({"filenames":files})

@backend.app.route('/exercises/<exerciseid>/starter_files/', methods = ['POST'])
@verify_login
def add_starter_files(exerciseid,email):
    cur = backend.conn.cursor()
    #TODO check if filename already exists
    cur.execute("insert into starter_files (exerciseid, filename, filecontents) VALUES (%s,%s,%s)",(exerciseid,request.form['filename'],request.form['file_contents']))
    backend.conn.commit()
    cur.close()
    return {},201

@backend.app.route('/exercises/<exerciseid>/starter_files/', methods = ['PATCH'])
@verify_login
def remove_starter_files(exerciseid,email):
    cur = backend.conn.cursor()
    print(request.json)
    cur.execute("Delete from starter_files where exerciseid = %s and filename = %s",(exerciseid,request.form["filename"]))
    backend.conn.commit()
    cur.close()
    return {},204

@backend.app.route('/exercises/<exerciseid>/starter_files/<filename>/', methods = ['GET'])
@verify_login
def get_starter_file(exerciseid,filename,email):
    cur = backend.conn.cursor()
    print(filename)
    cur.execute("Select filecontents from starter_files where exerciseid = %s and filename = %s",(exerciseid,filename))
    filecontents = cur.fetchone()[0]
    cur.close()
    return bytes(filecontents),200