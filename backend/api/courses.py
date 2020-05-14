import backend
from flask import Flask,url_for, render_template,redirect, request
import flask
import time
import requests
import os,binascii
from backend.api.permissions import add_roles

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

def verify_login_admin(func):
    def wrapper(**kwargs):
        if 'Authorization' not in request.headers:
            return flask.abort(403)
        if request.headers['Authorization'].split(" ")[0] != "Token":
            return flask.abort(403)
        token = request.headers['Authorization'].split(" ")[1]
        cur = backend.conn.cursor()
        cur.execute("SELECT email, is_admin from users where token = %s",(token,))
        response = cur.fetchone()
        if response == None or response[1] == False:
            return flask.abort(403)
        cur.close()
        return func(*kwargs.values(),response[0])
    wrapper.__name__ = func.__name__
    return wrapper

@backend.app.route('/courses/', methods = ['GET'])
@verify_login
def get_courses(email):
    cur = backend.conn.cursor()
    cur.execute("SELECT * from courses")
    courses = cur.fetchall()
    cur.close()
    output = []
    for course in courses:
        output.append({"courseid":course[0],"name":course[1],"semester":course[2],"year":course[3]})
    return flask.jsonify(output)

@backend.app.route('/courses/', methods = ['POST'])
@verify_login_admin
def post_courses(email):
    new_course = request.form
    cur = backend.conn.cursor()
    cur.execute("INSERT INTO courses (name, semester, year) VALUES (%s,%s, %s)",(new_course["name"].replace(" ", "").lower(),new_course["semester"],new_course["year"]))
    backend.conn.commit()
    cur.close()
    return new_course, 201

@backend.app.route('/courses/<name>/<semester>/<year>/', methods = ['GET'])
@verify_login
def find_course(name,semester,year,email):
    cur = backend.conn.cursor()
    cur.execute("SELECT * from courses WHERE name=%s AND semester=%s AND year=%s",(name.replace(" ", "").lower(),semester.lower(),year))
    course = cur.fetchone()
    cur.close()

    if course == None:
        return flask.abort(404)

    output = {"courseid":course[0],"name":course[1],"semester":course[2],"year":course[3]}
    return flask.jsonify(output)

@backend.app.route('/courses/<courseid>/', methods = ['GET'])
@verify_login
def find_course_id(courseid,email):

    cur = backend.conn.cursor()
    cur.execute("SELECT * from courses WHERE courseid=%s",(courseid,))
    course = cur.fetchone()

    cur.close()
    if course == None:
        return flask.abort(404)
        
    output = {"courseid":course[0],"name":course[1],"semester":course[2],"year":course[3]}
    return flask.jsonify(output)

@backend.app.route('/courses/<courseid>/copy/', methods = ['POST'])
@verify_login_admin
def copy_course(courseid,email):

    cur = backend.conn.cursor()
    cur.execute("SELECT * from courses WHERE courseid=%s",(courseid,))
    course = cur.fetchone()
    if course == None:
        cur.close()
        return flask.abort(404)
    
    cur.execute("INSERT INTO courses (name, semester, year) VALUES (%s,%s, %s) returning courseid",(course[1].replace(" ", "").lower(),course[2],course[3]))
    new_course_id = cur.fetchone()

    cur.execute("select email from users_courses where courseid=%s and role=0",(courseid,))
    emails = cur.fetchall()
    add_roles(new_course_id[0],0,email,emails)

    cur.execute("insert into exercises (courseid,published,name) select %s,published,name from exercises where courseid=%s",(new_course_id[0],courseid))
    
    cur.execute("insert into starter_files (exerciseid,filename,filecontents) select %s,filename,filecontents from starter_files where exerciseid = any(select exerciseid from exercises where courseid=%s)",(new_course_id[0],courseid,))
     
    backend.conn.commit()
    cur.close()

    output = {"courseid":new_course_id[0],"name":course[1],"semester":course[2],"year":course[3]}
    return output, 201

@backend.app.route('/courses/<courseid>/', methods = ['PATCH'])
@verify_login
def edit_course(courseid,email):
    
    cur = backend.conn.cursor()
    cur.execute("select * from courses where courseid = %s",(courseid,))
    course = cur.fetchone()

    if course == None:
        cur.close()
        return flask.abort(404)

    cur.execute("SELECT role from users_courses WHERE email=%s AND courseid=%s",(email,courseid))
    course = cur.fetchone()

    if course[0] != 0:
        cur.close()
        flask.abort(403)

    edited_course = request.form

    if "name" in edited_course:
        cur.execute("UPDATE courses SET name=%s WHERE courseid=%s",(edited_course["name"].replace(" ", "").lower(),courseid))
    
    if "semester" in edited_course:
        cur.execute("UPDATE courses SET semester=%s WHERE courseid=%s",(edited_course["semester"].replace(" ", "").lower(),courseid))
    
    if "year" in edited_course:
        cur.execute("UPDATE courses SET year=%s WHERE courseid=%s",(edited_course["year"].replace(" ", "").lower(),courseid))

    backend.conn.commit()    

    cur.close()
    return flask.jsonify(edited_course)


@backend.app.route('/courses/<courseid>/', methods = ['DELETE'])
@verify_login_admin
def delete_course(courseid,email):
    
    cur = backend.conn.cursor()
    cur.execute("select * from courses where courseid = %s",(courseid,))
    course = cur.fetchone()

    if course == None:
        cur.close()
        return flask.abort(404)

    cur.execute("DELETE FROM courses where courseid = %s",(courseid,))
    backend.conn.commit()
    cur.close()
    return {},204

#add checks to see which user can do what